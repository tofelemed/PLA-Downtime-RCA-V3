import { randomUUID } from 'crypto';
import { signToken } from './support/test-app';
import { ActualsWorld } from './support/actuals-world';
import { DAY1 } from './support/plan-world';

/**
 * Enhanced Historian readers (persona gap "historian gated to integration roles"): the page's reads —
 * `GET /v2/signals` and the read-only `POST /v2/signals/:id/preview` — are open to the plant's analysis
 * readers (viewer, analyst, production / reliability engineer); defining signals stays with
 * INTEGRATION_WRITERS (403 FORBIDDEN_ROLE). Test data only.
 */
describe('Historian reads for plant readers (v2 signals)', () => {
  const env = new ActualsWorld();
  let signalId = '';
  const readers: Record<string, string> = {};

  const tenantUser = async (role: string): Promise<string> => {
    const userId = randomUUID();
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'reader', $2, 'x', 'Engineer', $3)`,
      [userId, `${userId}@test.local`, env.world.tenantA],
    );
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'tenant', $1, $3, 1)`,
      [env.world.tenantA, userId, role],
    );
    return signToken(env.app, { userId, tenantId: env.world.tenantA, role });
  };

  beforeAll(async () => {
    await env.start();
    signalId = await env.signal({
      unitId: env.world.unitA1,
      semanticType: 'counter',
      from: '2027-01-01T00:00:00Z',
      to: '2028-01-01T00:00:00Z',
    });
    await env.samples(signalId, DAY1, [
      [0, '100'],
      [30, '130'],
      [60, '160'],
    ]);
    for (const role of [
      'viewer',
      'production_engineer',
      'reliability_engineer',
    ])
      readers[role] = await tenantUser(role);
    readers.Analyst = env.analyst;
  });
  afterAll(() => env.stop());

  it.each(['viewer', 'Analyst', 'production_engineer', 'reliability_engineer'])(
    '%s lists signals and reads stored samples',
    async (role) => {
      const list = (
        await env.get('signals?limit=200', readers[role]).expect(200)
      ).body as { items: Array<{ id: string }> };
      expect(list.items.map((item) => item.id)).toContain(signalId);
      const to = new Date(Date.parse(DAY1) + 2 * 3_600_000).toISOString();
      const preview = (
        await env
          .post(
            `signals/${signalId}/preview`,
            { from: DAY1, to },
            readers[role],
          )
          .expect(200)
      ).body as { samples: unknown[] };
      expect(preview.samples.length).toBe(3);
    },
  );

  it.each(['viewer', 'reliability_engineer'])(
    '%s cannot define a signal (integration writers only)',
    async (role) => {
      const response = await env
        .post(
          'signals',
          {
            connectionId: env.connections.pi,
            name: 'refused',
            sourceKey: `refused-${randomUUID()}`,
            semanticType: 'counter',
            canonicalUom: 't',
            effectiveFrom: DAY1,
          },
          readers[role],
        )
        .expect(403);
      expect((response.body as { code: string }).code).toMatch(
        /FORBIDDEN_ROLE|READ_ONLY_ROLE/,
      );
    },
  );
});
