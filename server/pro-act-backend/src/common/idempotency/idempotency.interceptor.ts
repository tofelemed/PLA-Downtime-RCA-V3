import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, concatMap, map, switchMap } from 'rxjs/operators';
import { requireTenantId } from '../context/request-context';
import { RequestWithContext } from '../context/request-context.middleware';
import { PreconditionRequiredException } from '../errors/precondition-required.exception';
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENT_KEY,
  IDEMPOTENT_REPLAYED_HEADER,
} from './idempotent.decorator';
import { IdempotencyService } from './idempotency.service';

const MAX_KEY_LENGTH = 255;

/**
 * Global interceptor implementing API02 for handlers decorated with `@Idempotent()`:
 * missing key → 428; same key + same request → stored response with `Idempotent-Replayed: true`;
 * same key + different request → 409 IDEMPOTENCY_MISMATCH; concurrent duplicate → 409 IDEMPOTENCY_IN_PROGRESS.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotency: IdempotencyService,
  ) {}

  intercept(
    executionContext: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const handler = executionContext.getHandler();
    if (!this.reflector.get<boolean>(IDEMPOTENT_KEY, handler)) {
      return next.handle();
    }
    const http = executionContext.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    const key = readKey(request);
    const tenantId = requireTenantId(request.requestContext);
    const requestHash = this.idempotency.hashRequest(
      request.method,
      request.path,
      request.body,
    );
    const successStatus =
      this.reflector.get<number>(HTTP_CODE_METADATA, handler) ??
      (request.method === 'POST' ? HttpStatus.CREATED : HttpStatus.OK);

    return from(this.idempotency.reserve(tenantId, key, requestHash)).pipe(
      switchMap((reservation) => {
        switch (reservation.kind) {
          case 'replay':
            response.setHeader(IDEMPOTENT_REPLAYED_HEADER, 'true');
            response.status(reservation.response.status);
            return of(reservation.response.body);
          case 'mismatch':
            return throwError(
              () =>
                new ConflictException({
                  code: 'IDEMPOTENCY_MISMATCH',
                  message:
                    'Idempotency-Key was already used with a different request',
                }),
            );
          case 'in_progress':
            return throwError(
              () =>
                new ConflictException({
                  code: 'IDEMPOTENCY_IN_PROGRESS',
                  message:
                    'A request with this Idempotency-Key is still being processed',
                }),
            );
          case 'new':
            return next.handle().pipe(
              // Persist before answering so an immediate retry replays instead of seeing 'in progress'
              concatMap((body: unknown) =>
                from(
                  this.idempotency.complete(tenantId, key, {
                    status: storedStatus(response, successStatus),
                    body,
                  }),
                ).pipe(map(() => body)),
              ),
              catchError((error: unknown) =>
                from(this.idempotency.abandon(tenantId, key)).pipe(
                  switchMap(() => throwError(() => error)),
                ),
              ),
            );
        }
      }),
    );
  }
}

/**
 * Status to replay: Nest sets the route's status before interceptors run, so a different 2xx on the
 * response was chosen by the handler itself (e.g. 202 when a command became a job).
 */
function storedStatus(response: Response, routeStatus: number): number {
  const status = response.statusCode;
  return status >= 200 && status < 300 ? status : routeStatus;
}

function readKey(request: Request): string {
  const raw = request.headers[IDEMPOTENCY_KEY_HEADER];
  const key = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!key) {
    throw new PreconditionRequiredException(
      'IDEMPOTENCY_KEY_REQUIRED',
      'This command requires an Idempotency-Key header',
    );
  }
  if (key.length > MAX_KEY_LENGTH) {
    throw new PreconditionRequiredException(
      'IDEMPOTENCY_KEY_INVALID',
      `Idempotency-Key must be at most ${MAX_KEY_LENGTH} characters`,
    );
  }
  return key;
}
