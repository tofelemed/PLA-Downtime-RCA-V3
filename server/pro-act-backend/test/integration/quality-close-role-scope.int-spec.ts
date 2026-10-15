import { randomUUID } from 'crypto';
import { A, B } from './support/actuals-world';
import { PlanWorld } from './support/plan-world';
import { signToken } from './support/test-app';

/** Broad read access must not widen a unit-specific quality/finance/management grant. */
describe('quality decisions and month close enforce the scope of the required role', () => {
  const env = new PlanWorld();
  const tokens = new Map<string, string>();
  const EMPTY_MONTH = '1405-11';

  async function person(
    unitRole: string,
    tenantRole = 'viewer',
  ): Promise<string> {
    const id = randomUUID();
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id)
       VALUES ($1, 'Scoped quality/close reviewer', $2, 'x', 'viewer', $3)`,
      [id, `${id}@test.local`, env.world.tenantA],
    );
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'tenant', $1, $3, 1), ($1, $2, 'unit', $4, $5, 1)`,
      [env.world.tenantA, id, tenantRole, env.world.unitA1, unitRole],
    );
    return signToken(env.app, {
      userId: id,
      tenantId: env.world.tenantA,
      role: 'viewer',
    });
  }

  const disposition = (unitId: string) => ({
    unitId,
    productId: env.products.p1,
    lotCode: `SCOPE-${randomUUID()}`,
    dispositionClass: 'scrap',
    quantity: '1',
    uom: 't',
    productionStart: A,
    productionEnd: B,
    evidenceRef: 'scope regression laboratory record',
  });

  async function propose(unitId: string): Promise<string> {
    const response = await env
      .post('lot-dispositions', disposition(unitId))
      .expect(201);
    return (response.body as { id: string }).id;
  }

  beforeAll(async () => {
    await env.start();
    for (const role of [
      'quality_approver',
      'manager_approver',
      'finance_approver',
      'production_accountant',
    ]) {
      tokens.set(role, await person(role));
    }
    tokens.set(
      'qualityWithAccounting',
      await person('quality_approver', 'production_accountant'),
    );
    tokens.set(
      'reviewerWithFinance',
      await person('production_accountant', 'finance_approver'),
    );
  });
  afterAll(() => env.stop());

  it('a unit quality writer cannot propose in another unit through a tenant viewer grant', async () => {
    const token = tokens.get('quality_approver')!;
    await env
      .post('lot-dispositions', disposition(env.world.unitA1), token)
      .expect(201);
    const response = await env.post(
      'lot-dispositions',
      disposition(env.world.unitA2),
      token,
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({
      status: 403,
      body: { code: 'FORBIDDEN_ROLE' },
    });
  });

  it.each(['approve', 'reject'])(
    'a unit A1 quality role cannot %s an A2 disposition despite tenant-wide accounting access',
    async (action) => {
      const id = await propose(env.world.unitA2);
      const token = tokens.get('qualityWithAccounting')!;
      await env.get(`lot-dispositions/${id}`, token).expect(200);
      const response = await env.post(
        `lot-dispositions/${id}/${action}`,
        { reason: 'scope boundary check' },
        token,
      );
      expect({
        status: response.status,
        body: response.body as unknown,
      }).toMatchObject({
        status: 403,
        body: { code: 'FORBIDDEN_ROLE' },
      });
      const unchanged = await env.get(`lot-dispositions/${id}`).expect(200);
      expect(unchanged.body).toMatchObject({ state: 'proposed' });
    },
  );

  it('the same quality approver can decide a disposition on the granted unit', async () => {
    const id = await propose(env.world.unitA1);
    await env
      .post(
        `lot-dispositions/${id}/approve`,
        {},
        tokens.get('qualityWithAccounting'),
      )
      .expect(200);
    const read = await env.get(`lot-dispositions/${id}`).expect(200);
    expect(read.body).toMatchObject({ state: 'approved' });
  });

  it.each([
    ['close-quantities', 'manager_approver'],
    ['materiality-review', 'production_accountant'],
    ['finance-sign-off', 'finance_approver'],
    ['lock', 'finance_approver'],
    ['reopen', 'manager_approver'],
  ])(
    'a tenant viewer with only a unit %s role cannot change the plant month',
    async (action, role) => {
      const before = await env.rows<{ count: string }>(
        'SELECT count(*)::text AS count FROM month_close_actions WHERE tenant_id=$1',
        [env.world.tenantA],
      );
      const body =
        action === 'reopen' ? { reason: 'scope boundary check' } : {};
      const response = await env.post(
        `month-closes/${EMPTY_MONTH}/${action}`,
        body,
        tokens.get(role),
      );
      expect({
        status: response.status,
        body: response.body as unknown,
      }).toMatchObject({
        status: 403,
        body: { code: 'FORBIDDEN_ROLE' },
      });
      const after = await env.rows<{ count: string }>(
        'SELECT count(*)::text AS count FROM month_close_actions WHERE tenant_id=$1',
        [env.world.tenantA],
      );
      expect(after).toEqual(before);
    },
  );

  it('a policy reviewer role limited to one unit cannot be borrowed by a tenant-wide finance role', async () => {
    const response = await env.post(
      `month-closes/${EMPTY_MONTH}/materiality-review`,
      {},
      tokens.get('reviewerWithFinance'),
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({
      status: 403,
      body: { code: 'MATERIALITY_REVIEWER' },
    });
  });

  it('genuine plant-wide management and independent finance roles still close and lock an empty month', async () => {
    const month = '1405-10';
    const closed = await env
      .post(`month-closes/${month}/close-quantities`, {}, env.approver)
      .expect(200);
    expect(closed.body).toMatchObject({ state: 'quantities_closed' });
    await env
      .post(`month-closes/${month}/finance-sign-off`, {}, env.financeApprover)
      .expect(200);
    const locked = await env
      .post(`month-closes/${month}/lock`, {}, env.financeApprover)
      .expect(200);
    expect(locked.body).toMatchObject({ state: 'locked' });
  });
});
