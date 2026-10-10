import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ApiErrorBody, FieldError } from '../errors/api-error-body';
import { apiErrorCode, isRetryableStatus } from '../errors/api-error-codes';
import { ValidationFailedException } from '../errors/validation-failed.exception';
import { resolveCorrelationId } from '../http/correlation-id';
import { redactSecrets } from '../logging/redact';

interface DescribedError {
  status: number;
  body: ApiErrorBody;
}

/** `/api/v2/...` (production) or `/v2/...` (apps bootstrapped without the global prefix). */
const V2_PATH = /^\/(api\/)?v2(\/|\?|$)/;
const DEFAULT_RETRY_AFTER_SECONDS = 60;

/**
 * Shapes every error as the API03 envelope `{ code, message, fieldErrors?, correlationId, retryable }`.
 *
 * - class-validator failures → `VALIDATION_FAILED`: 400 on v1 routes (what the UI expects), 422 on /api/v2
 * - stack traces and internal error messages go to the log only, never to the client
 * - `message` stays a string (or string[] for validation) so the frontend `ApiError` parser keeps working
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const correlationId = resolveCorrelationId(request, response);

    const { status, body } = this.describe(exception, request, correlationId);
    this.log(exception, request, status, body);

    if (
      status === HttpStatus.TOO_MANY_REQUESTS &&
      !response.getHeader('Retry-After')
    ) {
      response.setHeader('Retry-After', String(DEFAULT_RETRY_AFTER_SECONDS));
    }
    response.status(status).json(body);
  }

  private describe(
    exception: unknown,
    request: Request,
    correlationId: string,
  ): DescribedError {
    if (exception instanceof ValidationFailedException) {
      const status = isV2Request(request)
        ? HttpStatus.UNPROCESSABLE_ENTITY
        : HttpStatus.BAD_REQUEST;
      return {
        status,
        body: {
          code: 'VALIDATION_FAILED',
          message: exception.messages,
          fieldErrors: exception.fieldErrors,
          correlationId,
          retryable: false,
        },
      };
    }
    if (exception instanceof HttpException) {
      return this.describeHttpException(exception, correlationId);
    }
    const database = describeDatabaseRefusal(exception, request, correlationId);
    if (database) return database;
    const body = describeBodyParserError(exception, correlationId);
    if (body) return body;
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        correlationId,
        retryable: false,
      },
    };
  }

  private describeHttpException(
    exception: HttpException,
    correlationId: string,
  ): DescribedError {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    const details =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)
        : {};
    const message = pickMessage(
      details.message,
      typeof payload === 'string' ? payload : exception.message,
    );
    const isLegacyValidation =
      Array.isArray(message) && status === HttpStatus.BAD_REQUEST;
    const code =
      typeof details.code === 'string'
        ? details.code
        : isLegacyValidation
          ? 'VALIDATION_FAILED'
          : apiErrorCode(status);

    const body: ApiErrorBody = {
      code,
      message,
      correlationId,
      retryable: isRetryableStatus(status),
    };
    if (Array.isArray(details.fieldErrors)) {
      body.fieldErrors = details.fieldErrors as FieldError[];
    }
    if (isPlainRecord(details.details)) {
      body.details = details.details;
    }
    return { status, body };
  }

  private log(
    exception: unknown,
    request: Request,
    status: number,
    body: ApiErrorBody,
  ): void {
    const line = redactSecrets(
      `${request.method} ${request.originalUrl ?? request.url} -> ${status} ${body.code} [${body.correlationId}]`,
    );
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        line,
        redactSecrets(
          exception instanceof Error
            ? (exception.stack ?? exception.message)
            : String(exception),
        ),
      );
      return;
    }
    const summary = Array.isArray(body.message)
      ? body.message.join('; ')
      : body.message;
    this.logger.warn(redactSecrets(`${line}: ${summary}`));
  }
}

/**
 * Database refusals a caller can cause (plan 3.11): a reference to a row that does not exist (23503, e.g. an
 * RCA analysis for a missing RCA; 409 when a delete is blocked by rows still referencing it) and a
 * row-level-security refusal (42501, a row of another tenant). Never echoes the SQL or the driver message.
 */
function describeDatabaseRefusal(
  exception: unknown,
  request: Request,
  correlationId: string,
): DescribedError | null {
  if (!(exception instanceof QueryFailedError)) return null;
  const driver = exception.driverError as
    | { code?: unknown; detail?: unknown }
    | undefined;
  const code = driver?.code;
  if (
    code === '23503' &&
    typeof driver?.detail === 'string' &&
    driver.detail.includes('still referenced')
  ) {
    return {
      status: HttpStatus.CONFLICT,
      body: {
        code: 'RECORD_IN_USE',
        message: 'The record is still referenced by other records',
        correlationId,
        retryable: false,
      },
    };
  }
  if (code === '23503') {
    return {
      status: isV2Request(request)
        ? HttpStatus.UNPROCESSABLE_ENTITY
        : HttpStatus.BAD_REQUEST,
      body: {
        code: 'INVALID_REFERENCE',
        message: 'A referenced record does not exist',
        correlationId,
        retryable: false,
      },
    };
  }
  if (code === '42501') {
    return {
      status: HttpStatus.FORBIDDEN,
      body: {
        code: 'TENANT_NOT_ALLOWED',
        message: 'The record belongs to a tenant outside your access',
        correlationId,
        retryable: false,
      },
    };
  }
  return null;
}

/**
 * Body-parser refusals (plan 3.11 request limits): a body above 1 MiB is 413, malformed JSON 400. They
 * are plain errors with an exposed 4xx `status`, not HttpExceptions.
 */
function describeBodyParserError(
  exception: unknown,
  correlationId: string,
): DescribedError | null {
  const error = exception as {
    status?: unknown;
    expose?: unknown;
    type?: unknown;
  } | null;
  if (
    !error ||
    error.expose !== true ||
    typeof error.status !== 'number' ||
    error.status < 400 ||
    error.status >= 500
  ) {
    return null;
  }
  const status = error.status;
  return {
    status,
    body: {
      code: status === 413 ? 'PAYLOAD_TOO_LARGE' : apiErrorCode(status),
      message:
        status === 413 ? 'Request body too large' : 'Malformed request body',
      correlationId,
      retryable: false,
    },
  };
}

function pickMessage(candidate: unknown, fallback: string): string | string[] {
  if (Array.isArray(candidate)) {
    return candidate.filter((item): item is string => typeof item === 'string');
  }
  if (typeof candidate === 'string' && candidate.length > 0) {
    return candidate;
  }
  return fallback;
}

function isV2Request(request: Request): boolean {
  return V2_PATH.test(request.originalUrl ?? request.url ?? '');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
