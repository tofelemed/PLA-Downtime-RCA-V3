import { randomUUID } from 'crypto';
import { PlanWorld } from './support/plan-world';
import { signToken } from './support/test-app';

interface Person {
  id: string;
  token: string;
}

/** Mixed read/write scopes must not turn a unit-specific specialist role into plant-wide authority. */
describe('uncertainty decisions enforce the role on the budget unit', () => {
  const env = new PlanWorld();
  let owner: Person;
  let deputy: Person;
  let adopter: Person;
  let author: Person;

  async function person(role: string): Promise<Person> {
    const id = randomUUID();
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id)
       VALUES ($1, 'Scoped test persona', $2, 'x', 'Operator', $3)`,
      [id, `${id}@test.local`, env.world.tenantA],
    );
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'tenant', $1, $3, 1)`,
      [env.world.tenantA, id, role],
    );
    return {
      id,
      token: signToken(env.app, {
        userId: id,
        tenantId: env.world.tenantA,
        role: 'Operator',
      }),
    };
  }

  const budgetInput = (unitId: string) => ({
    unitId,
    boundary: `scope_${randomUUID()}`,
    uom: 't',
    components: [
      { kind: 'meter', label: 'Certified meter', standardUncertainty: '0.3' },
    ],
    coverageFactor: '2',
    calibrationRef: 'scope regression certificate',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    reviewDueAt: '2031-01-01T00:00:00.000Z',
  });

  async function budget(unitId: string): Promise<string> {
    const result = await env
      .post('uncertainty-budgets', budgetInput(unitId), author.token)
      .expect(201);
    return (result.body as { id: string }).id;
  }

  beforeAll(async () => {
    await env.start();
    owner = await person('metrology_approver');
    deputy = await person('production_accountant');
    author = await person('production_engineer');
    adopter = await person('viewer');
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'unit', $3, 'production_accountant', 1)`,
      [env.world.tenantA, adopter.id, env.world.unitA1],
    );
    await env
      .post(
        'role-delegations',
        {
          delegatorId: owner.id,
          delegateId: deputy.id,
          role: 'metrology_approver',
          scopeKind: 'unit',
          scopeId: env.world.unitA1,
          validFrom: new Date(Date.now() - 60_000).toISOString(),
          validUntil: new Date(Date.now() + 86_400_000).toISOString(),
          reason: 'temporary unit A1 laboratory cover',
        },
        owner.token,
      )
      .expect(201);
  });
  afterAll(() => env.stop());

  it('a unit accountant may prepare a budget only on their own unit despite broader read access', async () => {
    await env
      .post('uncertainty-budgets', budgetInput(env.world.unitA1), adopter.token)
      .expect(201);
    const response = await env.post(
      'uncertainty-budgets',
      budgetInput(env.world.unitA2),
      adopter.token,
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({
      status: 403,
      body: { code: 'FORBIDDEN_ROLE' },
    });
  });

  it('the delegate can approve a budget on the delegated unit', async () => {
    const id = await budget(env.world.unitA1);
    await env
      .post(`uncertainty-budgets/${id}/approve`, {}, deputy.token)
      .expect(200);
  });

  it.each(['approve', 'reject'])(
    'the delegate cannot %s a different unit budget despite plant-wide accountant access',
    async (action) => {
      const id = await budget(env.world.unitA2);
      const response = await env.post(
        `uncertainty-budgets/${id}/${action}`,
        { reason: 'scope boundary check' },
        deputy.token,
      );
      expect({
        status: response.status,
        body: response.body as unknown,
      }).toMatchObject({
        status: 403,
        body: { code: 'FORBIDDEN_ROLE' },
      });
    },
  );

  it('a unit accountant cannot adopt a different unit tolerance despite plant-wide viewer access', async () => {
    const id = await budget(env.world.unitA2);
    await env
      .post(`uncertainty-budgets/${id}/approve`, {}, owner.token)
      .expect(200);
    const response = await env.post(
      `uncertainty-budgets/${id}/adopt-as-tolerance`,
      {},
      adopter.token,
    );
    expect({
      status: response.status,
      body: response.body as unknown,
    }).toMatchObject({
      status: 403,
      body: { code: 'FORBIDDEN_ROLE' },
    });
  });

  it('the unit accountant can adopt an approved budget on their own unit', async () => {
    const id = await budget(env.world.unitA1);
    await env
      .post(`uncertainty-budgets/${id}/approve`, {}, owner.token)
      .expect(200);
    await env
      .post(`uncertainty-budgets/${id}/adopt-as-tolerance`, {}, adopter.token)
      .expect(200);
  });
});
