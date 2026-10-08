import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const CORRELATION_ID_RESPONSE_HEADER = 'X-Correlation-Id';

/** Accept only short, printable ids from clients so logs cannot be polluted with arbitrary payloads. */
const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function normalizeCorrelationId(candidate: unknown): string {
  return typeof candidate === 'string' && SAFE_CORRELATION_ID.test(candidate)
    ? candidate
    : randomUUID();
}

/**
 * Returns the request's correlation id, assigning one (and echoing it on the response) when the
 * middleware did not run for this path, e.g. for 404s raised before routing.
 */
export function resolveCorrelationId(
  request: Request,
  response: Response,
): string {
  const existing = request.headers[CORRELATION_ID_HEADER];
  const current = Array.isArray(existing) ? existing[0] : existing;
  if (typeof current === 'string' && SAFE_CORRELATION_ID.test(current)) {
    if (
      !response.headersSent &&
      !response.getHeader(CORRELATION_ID_RESPONSE_HEADER)
    ) {
      response.setHeader(CORRELATION_ID_RESPONSE_HEADER, current);
    }
    return current;
  }
  const generated = normalizeCorrelationId(current);
  request.headers[CORRELATION_ID_HEADER] = generated;
  if (!response.headersSent) {
    response.setHeader(CORRELATION_ID_RESPONSE_HEADER, generated);
  }
  return generated;
}
