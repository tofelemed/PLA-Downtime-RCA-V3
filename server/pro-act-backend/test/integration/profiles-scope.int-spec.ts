import { randomUUID } from 'crypto';
import { ApiError, ProfileWorld } from './support/profile-world';
import { signToken } from './support/test-app';

/**
 * Writes with tenant-wide effect (rate imports, valuation rates without a profile) need a
 * tenant-wide grant: an approver limited to one unit gets 403 TENANT_SCOPE_REQUIRED (WF05).
 */
describe('profile writes and the unit scope', () => {
  const env = new ProfileWorld();
  let unitApprover = '';

  beforeAll(async () => {
    await env.start();
    const userId = randomUUID();
    await env.harness.dataSource.query(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id)
       VALUES ($1, 'unit approver', $2, 'x', 'Operator', $3)`,
      [userId, `${userId}@test.local`, env.world.tenantA],
    );
    await env.harness.dataSource.query(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'unit', $3, 'manager_approver', 1)`,
      [env.world.tenantA, userId, env.world.unitA1],
    );
    unitApprover = signToken(env.app, {
      userId,
      tenantId: env.world.tenantA,
      role: 'Operator',
    });
  });
  afterAll(() => env.stop());

  it('refuses rate imports from a unit-limited approver', async () => {
    const response = await env
      .post(
        'rate-imports',
        {
          kind: 'budget',
          externalId: 'SCOPED-1',
          rows: [
            {
              unitCode: 'unit-not-mine',
              productCode: 'HDPE-A',
              rate: '110',
              timebase: 'h',
              effectiveFrom: '2026-11-01T00:00:00Z',
            },
          ],
        },
        unitApprover,
      )
      .expect(403);
    expect((response.body as ApiError).code).toBe('TENANT_SCOPE_REQUIRED');
  });

  it('refuses tenant-wide valuation rates from a unit-limited approver', async () => {
    const response = await env
      .post(
        'valuation-rates',
        {
          impactCodeId: env.impactCodes.iA,
          basis: 'cost_per_hour',
          value: '1000',
          currency: 'IRR',
          effectiveFrom: '2026-10-01T00:00:00Z',
        },
        unitApprover,
      )
      .expect(403);
    expect((response.body as ApiError).code).toBe('TENANT_SCOPE_REQUIRED');
  });
});
