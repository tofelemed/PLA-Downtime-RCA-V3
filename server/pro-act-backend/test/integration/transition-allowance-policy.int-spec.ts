import { AccountingWorld } from './support/accounting-world';
import { ApiError } from './support/plan-world';

interface AllowanceBody {
  id: string;
  unitId: string | null;
  version: number;
  transitionAllowanceInPlan: 'planned' | 'loss';
  notes: string | null;
}

/**
 * Engine 2.5.6 on real Postgres: the transition-allowance option of a unit as a new oee_policy version
 * effective now — the rest of the body (micro-stop settings) is carried forward, the plant keeps its own
 * version, the previous unit version ends, and only manager approvers with the right scope may write it.
 */
describe('transition allowance policy (engine 2.5.6)', () => {
  const env = new AccountingWorld();

  const body = async (unitId: string) => {
    const [row] = await env.rows<{
      body: Record<string, unknown>;
      effective_to: Date | null;
    }>(
      `SELECT "body", "effective_to" FROM "accounting_policies"
        WHERE "tenant_id" = $1 AND "policy_kind" = 'oee_policy' AND "scope_key" = $2
        ORDER BY "version" DESC LIMIT 1`,
      [env.world.tenantA, unitId],
    );
    return row;
  };

  beforeAll(() => env.start());
  afterAll(() => env.stop());

  it('reads the plant default and records a unit version that keeps the other fields', async () => {
    const plant = await env
      .get('transition-allowance-policies/current')
      .expect(200);
    expect((plant.body as AllowanceBody).transitionAllowanceInPlan).toBe(
      'planned',
    );
    await env
      .post('micro-stop-policies', {
        unitId: env.world.unitA1,
        microStopSeconds: 90,
        tripReasonCodes: ['PROC-TRIP'],
      })
      .expect(201);
    const created = await env
      .post('transition-allowance-policies', {
        unitId: env.world.unitA1,
        transitionAllowanceInPlan: 'loss',
        notes: 'plans spread campaign targets evenly',
      })
      .expect(201);
    expect(created.body as AllowanceBody).toMatchObject({
      unitId: env.world.unitA1,
      version: 2,
      transitionAllowanceInPlan: 'loss',
      notes: 'plans spread campaign targets evenly',
    });
    const stored = await body(env.world.unitA1);
    expect(stored.body).toMatchObject({
      transitionAllowanceInPlan: 'loss',
      microStopSeconds: 90,
      tripReasonCodes: ['PROC-TRIP'],
    });
    const [previous] = await env.rows<{ effective_to: Date | null }>(
      `SELECT "effective_to" FROM "accounting_policies"
        WHERE "tenant_id" = $1 AND "policy_kind" = 'oee_policy' AND "scope_key" = $2 AND "version" = 1`,
      [env.world.tenantA, env.world.unitA1],
    );
    expect(previous.effective_to).not.toBeNull();
    const unit = await env
      .get(`transition-allowance-policies/current?unitId=${env.world.unitA1}`)
      .expect(200);
    expect((unit.body as AllowanceBody).transitionAllowanceInPlan).toBe('loss');
    const after = await env
      .get('transition-allowance-policies/current')
      .expect(200);
    expect((after.body as AllowanceBody).transitionAllowanceInPlan).toBe(
      'planned',
    );
  });

  it('refuses an unknown option, a non-approver and a plant-wide write of a unit-scoped approver', async () => {
    await env
      .post('transition-allowance-policies', {
        unitId: env.world.unitA1,
        transitionAllowanceInPlan: 'sometimes',
      })
      .expect(422);
    const engineer = await env.unitUser(
      env.world.unitA1,
      'reliability_engineer',
    );
    await env
      .post(
        'transition-allowance-policies',
        { unitId: env.world.unitA1, transitionAllowanceInPlan: 'planned' },
        engineer,
      )
      .expect(403);
    const approver = await env.unitUser(env.world.unitA1);
    const plantWide = await env
      .post(
        'transition-allowance-policies',
        { transitionAllowanceInPlan: 'loss' },
        approver,
      )
      .expect(403);
    expect((plantWide.body as ApiError).code).toBe('TENANT_SCOPE_REQUIRED');
    await env
      .post(
        'transition-allowance-policies',
        { unitId: env.world.unitA2, transitionAllowanceInPlan: 'loss' },
        approver,
      )
      .expect(422);
    expect((await body(env.world.unitA1)).body).toMatchObject({
      transitionAllowanceInPlan: 'loss',
    });
  });
});
