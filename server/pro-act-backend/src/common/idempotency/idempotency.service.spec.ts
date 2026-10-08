import { Repository } from 'typeorm';
import { IdempotencyKey } from './idempotency-key.entity';
import { canonicalJson, IdempotencyService } from './idempotency.service';

const TENANT = 't1';

interface Where {
  tenantId: string;
  key: string;
  responseStatus?: number;
}

/** In-memory stand-in for `idempotency_keys` (PK tenant_id + key, 23505 on duplicate insert). */
function fakeKeys(): {
  rows: Map<string, Partial<IdempotencyKey>>;
  repo: Repository<IdempotencyKey>;
} {
  const rows = new Map<string, Partial<IdempotencyKey>>();
  const id = (where: Partial<Where>) => `${where.tenantId}|${where.key}`;
  const repo = {
    insert: (row: Partial<IdempotencyKey>) => {
      if (rows.has(id(row))) {
        return Promise.reject(
          Object.assign(new Error('duplicate key'), { code: '23505' }),
        );
      }
      rows.set(id(row), { ...row, responseBody: null });
      return Promise.resolve();
    },
    findOneBy: (where: Where) => Promise.resolve(rows.get(id(where)) ?? null),
    update: (where: Where, patch: Partial<IdempotencyKey>) => {
      const row = rows.get(id(where));
      if (!row) return Promise.resolve();
      // `() => 'NULL'` is a raw SQL expression in TypeORM
      const body =
        typeof patch.responseBody === 'function' ? null : patch.responseBody;
      Object.assign(row, patch, { responseBody: body ?? null });
      return Promise.resolve();
    },
    delete: (where: Where) => {
      const row = rows.get(id(where));
      if (
        row &&
        (where.responseStatus === undefined ||
          row.responseStatus === where.responseStatus)
      ) {
        rows.delete(id(where));
      }
      return Promise.resolve({ affected: 1 });
    },
  };
  return { rows, repo: repo as unknown as Repository<IdempotencyKey> };
}

describe('IdempotencyService', () => {
  it('hashes canonical JSON so key order does not matter', () => {
    const service = new IdempotencyService(fakeKeys().repo);
    expect(canonicalJson({ b: 1, a: { d: 2, c: undefined } })).toBe(
      '{"a":{"d":2},"b":1}',
    );
    expect(service.hashRequest('post', '/x', { a: 1, b: 2 })).toBe(
      service.hashRequest('POST', '/x', { b: 2, a: 1 }),
    );
    expect(service.hashRequest('POST', '/x', { a: 1 })).not.toBe(
      service.hashRequest('POST', '/y', { a: 1 }),
    );
  });

  it('new → in_progress → replay for the same request; mismatch for another body', async () => {
    const service = new IdempotencyService(fakeKeys().repo);
    expect(await service.reserve(TENANT, 'k', 'h1')).toEqual({ kind: 'new' });
    expect(await service.reserve(TENANT, 'k', 'h1')).toEqual({
      kind: 'in_progress',
    });
    await service.complete(TENANT, 'k', { status: 201, body: { id: 'e1' } });
    expect(await service.reserve(TENANT, 'k', 'h1')).toEqual({
      kind: 'replay',
      response: { status: 201, body: { id: 'e1' } },
    });
    expect(await service.reserve(TENANT, 'k', 'h2')).toEqual({
      kind: 'mismatch',
    });
  });

  it('scopes keys per tenant', async () => {
    const service = new IdempotencyService(fakeKeys().repo);
    await service.reserve(TENANT, 'k', 'h1');
    expect(await service.reserve('t2', 'k', 'h2')).toEqual({ kind: 'new' });
  });

  it('abandon frees a pending key; an expired key is taken over', async () => {
    const { repo, rows } = fakeKeys();
    const service = new IdempotencyService(repo);
    await service.reserve(TENANT, 'k', 'h1');
    await service.abandon(TENANT, 'k');
    expect(await service.reserve(TENANT, 'k', 'h2')).toEqual({ kind: 'new' });
    await service.complete(TENANT, 'k', { status: 201, body: {} });
    const row = rows.get(`${TENANT}|k`);
    if (row) row.expiresAt = new Date(Date.now() - 1);
    expect(await service.reserve(TENANT, 'k', 'h3')).toEqual({ kind: 'new' });
  });
});
