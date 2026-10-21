import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { AuditAutoLogInterceptor } from './audit-auto-log.interceptor';
import { AuditLogService } from './audit-log.service';
import { CLIENT_AUDITED_KEY } from './client-audited.decorator';
import { isPreviewBody } from './skip-audit-preview.decorator';
import { ProductionEventOperationsV2Controller } from '../v2/production-events/production-event-operations-v2.controller';

const caseId = '7b0d3f3e-7c3a-4a43-9a51-5f3e2f0b1c2d';
const actionId = '0f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

function httpContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

/** Runs the interceptor over a POST that returned `responseBody` and resolves once the audit row is written. */
async function recordedRow(
  path: string,
  params: Record<string, string>,
  responseBody: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const create = jest
    .fn<Promise<void>, [Record<string, unknown>]>()
    .mockResolvedValue(undefined);
  const interceptor = new AuditAutoLogInterceptor(
    { create } as unknown as AuditLogService,
    new Reflector(),
  );
  const request = {
    method: 'POST',
    originalUrl: path,
    params,
    body: { title: 'Replace seal' },
    user: { userId: 'u-1', email: 'amara@test.local', tenantId: 't-1' },
    headers: {},
  };
  const next: CallHandler = { handle: () => of(responseBody) };
  await lastValueFrom(interceptor.intercept(httpContext(request), next));
  await new Promise((resolve) => setImmediate(resolve));
  expect(create).toHaveBeenCalledTimes(1);
  return create.mock.calls[0][0];
}

describe('AuditAutoLogInterceptor attribution', () => {
  it('logs POST /v2/rcas/:id/actions against the case, naming the action in the details', async () => {
    const row = await recordedRow(
      `/api/v2/rcas/${caseId}/actions`,
      { id: caseId },
      { id: actionId, rcaId: caseId, title: 'Replace seal' },
    );
    expect(row).toMatchObject({
      action: 'CREATE',
      entityType: 'RCA',
      entityId: caseId,
      userId: 'u-1',
    });
    expect(row.details).toContain(`[actions ${actionId}]`);
  });

  it('still logs a collection POST against the created record', async () => {
    const row = await recordedRow('/api/v2/rcas', {}, { id: caseId });
    expect(row).toMatchObject({ entityType: 'RCA', entityId: caseId });
    expect(row.details).not.toContain('[');
  });
});

describe('AuditAutoLogInterceptor dry runs (QA audit F5)', () => {
  const bulkCode = Object.getOwnPropertyDescriptor(
    ProductionEventOperationsV2Controller.prototype,
    'bulkCode',
  )?.value as () => void;

  async function rowsFor(body: Record<string, unknown>): Promise<number> {
    const create = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditAutoLogInterceptor(
      { create } as unknown as AuditLogService,
      new Reflector(),
    );
    const context = {
      getHandler: () => bulkCode,
      getClass: () => ProductionEventOperationsV2Controller,
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/api/v2/production-events/bulk-code',
          params: {},
          body,
          user: { userId: 'u-1', tenantId: 't-1' },
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of({ count: 2 }) };
    await lastValueFrom(interceptor.intercept(context, next));
    await new Promise((resolve) => setImmediate(resolve));
    return create.mock.calls.length;
  }

  it('does not log a bulk-code preview as a create, but logs the apply', async () => {
    expect(await rowsFor({ preview: true, items: [] })).toBe(0);
    expect(await rowsFor({ preview: false, items: [] })).toBe(1);
  });

  it('only a boolean preview flag counts as a dry run', () => {
    expect(isPreviewBody({ preview: true })).toBe(true);
    expect(isPreviewBody({ preview: 'true' })).toBe(false);
    expect(isPreviewBody(null)).toBe(false);
  });
});

describe('AuditAutoLogInterceptor and X-Client-Audited (settings audit, 21 Oct 2026)', () => {
  const plantB = '3c0e7a52-2d4b-4f6c-9a8e-1b2c3d4e5f60';

  async function run(
    request: Record<string, unknown>,
    handler: () => void = function handler() {},
  ): Promise<jest.Mock> {
    const create = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditAutoLogInterceptor(
      { create } as unknown as AuditLogService,
      new Reflector(),
    );
    const context = {
      getHandler: () => handler,
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of({ id: 'x' }) };
    await lastValueFrom(interceptor.intercept(context, next));
    await new Promise((resolve) => setImmediate(resolve));
    return create;
  }

  const write = (headers: Record<string, string>) => ({
    method: 'POST',
    originalUrl: '/api/v2/tasks',
    params: {},
    body: { title: 'Check pump' },
    user: { userId: 'u-1', tenantId: 't-1' },
    headers,
  });

  it('ignores the header on an ordinary route: the server still audits', async () => {
    const create = await run(write({ 'x-client-audited': 'true' }));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('honours the header on a @ClientAudited() route', async () => {
    const handler = function clientAudited() {};
    Reflect.defineMetadata(CLIENT_AUDITED_KEY, true, handler);
    const create = await run(write({ 'x-client-audited': 'true' }), handler);
    expect(create).not.toHaveBeenCalled();
  });

  it('files a write to a plant record under that plant, not the plant the caller acts in', async () => {
    const create = await run({
      method: 'PUT',
      originalUrl: `/api/tenants/${plantB}`,
      params: { id: plantB },
      body: { name: 'Plant B' },
      user: { userId: 'u-1', tenantId: 't-1' },
      headers: {},
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'Tenant', tenantId: plantB }),
    );
  });
});
