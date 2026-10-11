import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  anonymousContext,
  RequestContext,
  ScopeGrant,
} from '../../common/context/request-context';
import { RequestContextFactory } from '../context/request-context.factory';
import { TenantBoundSpec } from '../decorators/tenant-bound.decorator';
import { AccessDenialAuditService } from '../scopes/access-denial-audit.service';
import { ScopeMembershipService } from '../scopes/scope-membership.service';
import { readTenantIds, TenantBindingGuard } from './tenant-binding.guard';

const HOME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const FOREIGN = '33333333-3333-4333-8333-333333333333';

interface FakeRequest {
  method: string;
  path: string;
  body?: unknown;
  query?: Record<string, unknown>;
  requestContext: RequestContext;
}

function grant(tenantId: string, role: string): ScopeGrant {
  return { kind: 'tenant', id: tenantId, role, tenantId };
}

function caller(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    ...anonymousContext('c'),
    userId: 'u',
    tenantId: HOME,
    legacyRole: 'Operator',
    roles: ['Operator', 'operator'],
    scopes: [grant(OTHER, 'viewer')],
    ...overrides,
  };
}

function executionContext(
  request: FakeRequest,
  spec: TenantBoundSpec | undefined,
): ExecutionContext {
  const handler = () => undefined;
  if (spec) Reflect.defineMetadata('tenantBound', spec, handler);
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => class Bound {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('TenantBindingGuard', () => {
  const record = jest.fn();
  const selectable = new Set([HOME, OTHER]);
  const guard = new TenantBindingGuard(
    new Reflector(),
    {
      isWithinScope: (context: RequestContext, _name: string, id: string) =>
        Promise.resolve(
          context.tenantId === id ||
            context.scopes.some((scope) => scope.tenantId === id),
        ),
    } as unknown as ScopeMembershipService,
    {
      maySelectTenant: (_context: RequestContext, id: string) =>
        Promise.resolve(selectable.has(id)),
    } as unknown as RequestContextFactory,
    { record } as unknown as AccessDenialAuditService,
  );
  const bound: TenantBoundSpec = { fill: true };

  const run = (
    request: FakeRequest,
    spec: TenantBoundSpec | undefined = bound,
  ) => guard.canActivate(executionContext(request, spec));

  const post = (body: unknown, context = caller()): FakeRequest => ({
    method: 'POST',
    path: '/api/tasks',
    body,
    query: {},
    requestContext: context,
  });

  beforeEach(() => record.mockClear());

  it('lets a write name the acting tenant and fills a POST body that names none', async () => {
    await expect(run(post({ tenantId: HOME }))).resolves.toBe(true);
    const body: Record<string, unknown> = { title: 't' };
    await expect(run(post(body))).resolves.toBe(true);
    expect(body.tenantId).toBe(HOME);
  });

  it('refuses a write naming another tenant, even one the caller may read, with TENANT_MISMATCH', async () => {
    await expect(run(post({ tenantId: OTHER }))).rejects.toMatchObject({
      response: { code: 'TENANT_MISMATCH' },
    });
    await expect(run(post({ tenantId: FOREIGN }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u' }),
      expect.objectContaining({ reason: 'TENANT_MISMATCH', entityId: OTHER }),
    );
  });

  it('checks the query of a write and a PUT body too, and never fills them', async () => {
    const put: FakeRequest = {
      ...post({ title: 'x' }),
      method: 'PUT',
      path: '/api/tasks/1',
    };
    await expect(run(put)).resolves.toBe(true);
    expect((put.body as Record<string, unknown>).tenantId).toBeUndefined();
    await expect(
      run({ ...post({}), query: { tenantId: OTHER } }),
    ).rejects.toMatchObject({ response: { code: 'TENANT_MISMATCH' } });
  });

  it('lets a read name a tenant within the scopes but not a foreign one', async () => {
    const get = (tenantId: string): FakeRequest => ({
      method: 'GET',
      path: '/api/tasks',
      query: { tenantId },
      requestContext: caller(),
    });
    await expect(run(get(OTHER))).resolves.toBe(true);
    await expect(run(get(FOREIGN))).rejects.toMatchObject({
      response: { code: 'TENANT_MISMATCH' },
    });
  });

  it('lets SuperAdmin and OrgAdmin write into a tenant they may select, nowhere else', async () => {
    const superAdmin = caller({
      isSuperAdmin: true,
      legacyRole: 'SuperAdmin',
      scopes: [],
    });
    await expect(run(post({ tenantId: OTHER }, superAdmin))).resolves.toBe(
      true,
    );
    await expect(
      run(post({ tenantId: FOREIGN }, superAdmin)),
    ).rejects.toMatchObject({
      response: { code: 'TENANT_MISMATCH' },
    });
    const orgAdmin = caller({ legacyRole: 'OrgAdmin', scopes: [] });
    await expect(run(post({ tenantId: OTHER }, orgAdmin))).resolves.toBe(true);
    await expect(
      run(post({ tenantId: FOREIGN }, orgAdmin)),
    ).rejects.toMatchObject({
      response: { code: 'TENANT_MISMATCH' },
    });
  });

  it('respects fill: false and ignores routes that are not bound', async () => {
    const body: Record<string, unknown> = { title: 't' };
    await expect(run(post(body), { fill: false })).resolves.toBe(true);
    expect(body.tenantId).toBeUndefined();
    await expect(
      guard.canActivate(
        executionContext(post({ tenantId: FOREIGN }), undefined),
      ),
    ).resolves.toBe(true);
  });

  it('reads tenant ids from a body or query; absent, null and empty count as none', () => {
    expect(readTenantIds(undefined)).toEqual([]);
    expect(readTenantIds({ tenantId: null })).toEqual([]);
    expect(readTenantIds({ tenantId: '' })).toEqual([]);
    expect(readTenantIds({ tenantId: HOME })).toEqual([HOME]);
    expect(readTenantIds({ tenantId: [HOME, OTHER] })).toEqual([HOME, OTHER]);
  });
});
