import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { AuditAutoLogInterceptor } from './audit-auto-log.interceptor';
import { AuditLogService } from './audit-log.service';

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
