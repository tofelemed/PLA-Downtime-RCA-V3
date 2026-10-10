import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ApiErrorBody } from '../errors/api-error-body';
import { ValidationFailedException } from '../errors/validation-failed.exception';
import { ApiExceptionFilter } from './api-exception.filter';

interface ResponseStub {
  statusCode: number;
  body: ApiErrorBody | undefined;
  headers: Record<string, string>;
  headersSent: boolean;
  status: (code: number) => ResponseStub;
  json: (body: ApiErrorBody) => ResponseStub;
  setHeader: (name: string, value: string) => void;
  getHeader: (name: string) => string | undefined;
}

function createHost(url: string, headers: Record<string, string> = {}) {
  const request = {
    method: 'GET',
    originalUrl: url,
    url,
    headers: { ...headers },
  };
  const response: ResponseStub = {
    statusCode: 0,
    body: undefined,
    headers: {},
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
    },
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, request, response };
}

function validationErrors(): ValidationError[] {
  const error = new ValidationError();
  error.property = 'unitId';
  error.constraints = { isUuid: 'unitId must be a UUID' };
  return [error];
}

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  beforeAll(() => Logger.overrideLogger(false));
  afterAll(() => Logger.overrideLogger(true));

  it('maps class-validator failures on v1 routes to 400 VALIDATION_FAILED with message[] and fieldErrors', () => {
    const { host, response } = createHost('/api/production-events?unitId=x');

    filter.catch(new ValidationFailedException(validationErrors()), host);

    expect(response.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(response.body).toEqual({
      code: 'VALIDATION_FAILED',
      message: ['unitId must be a UUID'],
      fieldErrors: [
        {
          field: 'unitId',
          message: 'unitId must be a UUID',
          constraint: 'isUuid',
        },
      ],
      correlationId: expect.any(String),
      retryable: false,
    });
  });

  it('maps class-validator failures on /api/v2 routes to 422', () => {
    const { host, response } = createHost('/api/v2/production-events?limit=0');

    filter.catch(new ValidationFailedException(validationErrors()), host);

    expect(response.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(response.body?.code).toBe('VALIDATION_FAILED');
  });

  it('keeps the legacy per-route ValidationPipe shape (400 + message[]) recognisable as validation', () => {
    const { host, response } = createHost('/api/reconcile-forms');

    filter.catch(
      new BadRequestException(['property foo should not exist']),
      host,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body?.code).toBe('VALIDATION_FAILED');
    expect(response.body?.message).toEqual(['property foo should not exist']);
  });

  it('uses the status default code and keeps the exception message for ordinary HttpExceptions', () => {
    const { host, response } = createHost('/api/units/42');

    filter.catch(new NotFoundException('Unit 42 not found'), host);

    expect(response.statusCode).toBe(404);
    expect(response.body).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Unit 42 not found',
      retryable: false,
    });
  });

  it('honours an explicit code in the exception response', () => {
    const { host, response } = createHost('/api/v2/periods/1/submit');

    filter.catch(
      new ConflictException({
        code: 'INVALID_TRANSITION',
        message: 'Period is closed',
      }),
      host,
    );

    expect(response.statusCode).toBe(409);
    expect(response.body).toMatchObject({
      code: 'INVALID_TRANSITION',
      message: 'Period is closed',
    });
  });

  it('never leaks internal error details or stack traces', () => {
    const { host, response } = createHost('/api/production-events');

    filter.catch(new Error('relation "secret_table" does not exist'), host);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      correlationId: expect.any(String),
      retryable: false,
    });
    expect(JSON.stringify(response.body)).not.toContain('secret_table');
    expect(response.body).not.toHaveProperty('stack');
  });

  it('marks 429 as retryable and guarantees a Retry-After header', () => {
    const { host, response } = createHost('/api/health');

    filter.catch(
      new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS),
      host,
    );

    expect(response.statusCode).toBe(429);
    expect(response.body).toMatchObject({
      code: 'RATE_LIMITED',
      retryable: true,
    });
    expect(response.headers['Retry-After']).toBeDefined();
  });

  it('echoes the client correlation id in the body and the response header', () => {
    const { host, response } = createHost('/api/x', {
      'x-correlation-id': 'client-corr-1',
    });

    filter.catch(new NotFoundException(), host);

    expect(response.body?.correlationId).toBe('client-corr-1');
    expect(response.headers['X-Correlation-Id']).toBe('client-corr-1');
  });

  it('generates a correlation id when the middleware did not run', () => {
    const { host, response } = createHost('/not-under-api');

    filter.catch(new NotFoundException(), host);

    expect(response.body?.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['X-Correlation-Id']).toBe(
      response.body?.correlationId,
    );
  });
});

describe('ApiExceptionFilter database refusals (plan 3.11)', () => {
  const { QueryFailedError } = jest.requireActual<typeof import('typeorm')>('typeorm');
  const failure = (code: string) =>
    new QueryFailedError('INSERT INTO x VALUES ($1)', ['secret-value'], Object.assign(new Error('driver says no'), { code }));

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('answers a missing reference with INVALID_REFERENCE (400 v1, 422 v2) and no SQL', () => {
    const v1 = createHost('/api/five-why-analyses');
    new ApiExceptionFilter().catch(failure('23503'), v1.host);
    expect(v1.response.statusCode).toBe(400);
    expect(v1.response.body?.code).toBe('INVALID_REFERENCE');
    expect(JSON.stringify(v1.response.body)).not.toContain('INSERT');
    const v2 = createHost('/api/v2/rcas');
    new ApiExceptionFilter().catch(failure('23503'), v2.host);
    expect(v2.response.statusCode).toBe(422);
  });

  it('answers a delete blocked by referencing rows with 409 RECORD_IN_USE', () => {
    const { host, response } = createHost('/api/rca-templates/1');
    const error = new QueryFailedError('DELETE', [], Object.assign(new Error('x'), {
      code: '23503',
      detail: 'Key (id)=(1) is still referenced from table "rcas".',
    }));
    new ApiExceptionFilter().catch(error, host);
    expect(response.statusCode).toBe(409);
    expect(response.body?.code).toBe('RECORD_IN_USE');
  });

  it('answers a row-level-security refusal with 403 TENANT_NOT_ALLOWED', () => {
    const { host, response } = createHost('/api/production-events');
    new ApiExceptionFilter().catch(failure('42501'), host);
    expect(response.statusCode).toBe(403);
    expect(response.body?.code).toBe('TENANT_NOT_ALLOWED');
  });

  it('keeps other database errors a generic 500', () => {
    const { host, response } = createHost('/api/x');
    new ApiExceptionFilter().catch(failure('40001'), host);
    expect(response.statusCode).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});

describe('ApiExceptionFilter body-parser refusals (plan 3.11)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('answers an oversized body with 413 PAYLOAD_TOO_LARGE', () => {
    const { host, response } = createHost('/api/v2/production-events');
    const error = Object.assign(new Error('request entity too large'), {
      status: 413,
      expose: true,
      type: 'entity.too.large',
    });
    new ApiExceptionFilter().catch(error, host);
    expect(response.statusCode).toBe(413);
    expect(response.body?.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
