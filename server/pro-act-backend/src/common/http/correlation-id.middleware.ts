import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import {
  CORRELATION_ID_HEADER,
  CORRELATION_ID_RESPONSE_HEADER,
  normalizeCorrelationId,
} from './correlation-id';

/**
 * Reads `X-Correlation-Id` from the client or generates one, stores the resolved value back on the
 * request headers (so filters, loggers and downstream calls see a single id) and echoes it on the response.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const correlationId = normalizeCorrelationId(
      request.header(CORRELATION_ID_HEADER),
    );
    request.headers[CORRELATION_ID_HEADER] = correlationId;
    response.setHeader(CORRELATION_ID_RESPONSE_HEADER, correlationId);
    next();
  }
}
