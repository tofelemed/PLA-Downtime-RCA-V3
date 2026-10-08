import { NextFunction, Request, Response } from 'express';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

function run(incoming?: string) {
  const headers: Record<string, string> = incoming
    ? { 'x-correlation-id': incoming }
    : {};
  const request = {
    headers,
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
  const responseHeaders: Record<string, string> = {};
  const response = {
    setHeader: (name: string, value: string) =>
      void (responseHeaders[name] = value),
  } as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;

  new CorrelationIdMiddleware().use(request, response, next);
  return { request, responseHeaders, next };
}

describe('CorrelationIdMiddleware', () => {
  it('generates an id when the client sends none and echoes it on the response', () => {
    const { request, responseHeaders, next } = run();

    expect(request.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(responseHeaders['X-Correlation-Id']).toBe(
      request.headers['x-correlation-id'],
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('keeps a well-formed client id', () => {
    const { request, responseHeaders } = run('ui-7f3a:retry.2');

    expect(request.headers['x-correlation-id']).toBe('ui-7f3a:retry.2');
    expect(responseHeaders['X-Correlation-Id']).toBe('ui-7f3a:retry.2');
  });

  it('replaces ids with unsafe characters or excessive length', () => {
    const { request } = run('bad id <script>');
    expect(request.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);

    const { request: longRequest } = run('a'.repeat(129));
    expect(longRequest.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
