import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  anonymousContext,
  RequestContext,
  ScopeGrant,
} from '../context/request-context';
import { restrictedUnitIds, scopedQuery } from './scoped-query';

const TENANT = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

function context(
  scopes: ScopeGrant[],
  overrides: Partial<RequestContext> = {},
): RequestContext {
  return {
    ...anonymousContext('c'),
    userId: 'u',
    tenantId: TENANT,
    scopes,
    ...overrides,
  };
}

function unit(id: string, tenantId = TENANT): ScopeGrant {
  return { kind: 'unit', id, role: 'operator', tenantId };
}

type Call = [string, string, Record<string, unknown>];

function fakeRepository(): {
  repository: Repository<{ id: string }>;
  calls: Call[];
} {
  const calls: Call[] = [];
  const qb = {
    where(sql: string, params: Record<string, unknown>) {
      calls.push(['where', sql, params]);
      return qb;
    },
    andWhere(sql: string, params: Record<string, unknown>) {
      calls.push(['and', sql, params]);
      return qb;
    },
  };
  const repository = { createQueryBuilder: () => qb } as unknown as Repository<{
    id: string;
  }>;
  return { repository, calls };
}

describe('restrictedUnitIds', () => {
  it('is null for tenant-wide, legacy (no scope rows) and SuperAdmin callers', () => {
    const tenantWide: ScopeGrant = {
      kind: 'tenant',
      id: TENANT,
      role: 'viewer',
      tenantId: TENANT,
    };
    expect(restrictedUnitIds(context([]), TENANT)).toBeNull();
    expect(
      restrictedUnitIds(context([tenantWide, unit('u1')]), TENANT),
    ).toBeNull();
    expect(
      restrictedUnitIds(context([unit('u1')], { isSuperAdmin: true }), TENANT),
    ).toBeNull();
  });

  it('lists the units of the acting tenant only', () => {
    const scopes = [unit('u1'), unit('u2'), unit('x', OTHER)];
    expect(restrictedUnitIds(context(scopes), TENANT)).toEqual(['u1', 'u2']);
  });
});

describe('scopedQuery', () => {
  it('always filters by the context tenant', () => {
    const { repository, calls } = fakeRepository();
    scopedQuery(repository, 'e', { context: context([]) });
    expect(calls).toEqual([
      ['where', 'e.tenantId = :scopeTenantId', { scopeTenantId: TENANT }],
    ]);
  });

  it('adds a unit restriction for unit-only grants', () => {
    const { repository, calls } = fakeRepository();
    scopedQuery(repository, 'e', {
      context: context([unit('u1')]),
      unitProperty: 'unitId',
    });
    expect(calls[1]).toEqual([
      'and',
      'e.unitId IN (:...scopeUnitIds)',
      { scopeUnitIds: ['u1'] },
    ]);
  });

  it('refuses to build a query without a tenant', () => {
    const { repository } = fakeRepository();
    expect(() =>
      scopedQuery(repository, 'e', { context: anonymousContext('c') }),
    ).toThrow(ForbiddenException);
  });
});
