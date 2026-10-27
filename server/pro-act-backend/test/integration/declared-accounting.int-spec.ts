import { A, B, HOUR } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';

const POLICY = {
  grain: 'shift',
  dayStart: '06:00',
  lossBasis: 'declared',
  targetSource: 'declared',
  accountingUnitId: null,
  stopsCrossCheck: true,
  identityTolerance: 0,
};

/**
 * Declared mode (spec §4.4) through a calculation run on real Postgres: with a unit `loss_accounting`
 * policy `lossBasis = declared`, the period's production loss event (window = the period) is loaded with
 * its OT figures and reason, the reason's default OEE component sets the line kind, the stop gives no
 * line (only the cross-check figure) and no capacity ledger is written. Test data only.
 */
describe('declared-mode calculation run (spec §4.4)', () => {
  const env = new AccountingWorld();
  let periodId = '';
  let lossId = '';

  beforeAll(async () => {
    await env.start();
    const unit = env.world.unitA2;
    await env.approvedPlan(unit);
    await env.materialize([unit]);
    periodId = await env.periodId(unit, A);
    await env.rows(
      `UPDATE reason_codes SET default_oee_component = 'availability' WHERE id = $1`,
      [env.world.reasonR1],
    );
    await env.rows(
      `INSERT INTO accounting_policies (tenant_id, row_version, policy_kind, unit_id, scope_key, version, body,
              effective_from, approved_at)
       VALUES ($1, 1, 'loss_accounting', $2::uuid, $2, 1, $3::jsonb, '2026-01-01T00:00:00Z', now())`,
      [env.world.tenantA, unit, JSON.stringify(POLICY)],
    );
    await env.outputEvent(unit, A, B, '300');
    await env.lossEvent(unit, plus(A, HOUR), 1, {
      reasonCodeId: env.world.reasonR1,
    });
    const created = await env
      .post('production-events', {
        unitId: unit,
        startTime: A,
        endTime: B,
        physicalType: 'production_loss',
        reasonCodeId: env.world.reasonR1,
        declaredFigures: {
          planned: 120,
          actual: 112.5,
          shortfall: 7.5,
          sourceStatus: 'CONFIRMED',
        },
      })
      .expect(201);
    lossId = (created.body as { id: string }).id;
    await env.settle();
  });
  afterAll(() => env.stop());

  it('writes the declared shortfall as the plan ledger, no stop line, no capacity ledger', async () => {
    const body = await env.accounting(periodId);
    expect(body.data.run).toMatchObject({ status: 'validated' });
    expect(body.data.totals.map((t) => t.ledger)).toEqual(['plan']);
    const plan = env.totals(body, 'plan');
    expect(plan).toMatchObject({
      target: '120',
      actual: '112.5',
      gap: '7.5',
      attributed: '7.5',
      residual: '0',
      availability: '7.5',
    });
    expect(plan.flags).toContain('capacity_not_applicable');
    expect(plan.flags).toContain('stops_cross_check:90:t');
    const lines = body.data.lines.filter((l) => l.kind !== 'residual');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      ledger: 'plan',
      kind: 'availability',
      quantity: '7.5',
      basis: 'declared',
      causeEventId: lossId,
    });
    expect(lines[0].evidence).toMatchObject([{ eventId: lossId, share: '1' }]);
  });
});
