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

/**
 * Declared mode on a unit with two approved profiles and no plan (spec D4): without the policy's
 * `accountingProductId` the period has no slice (`ambiguous_default_product`); once a version names it,
 * re-materializing the range re-resolves the slice-less period to one slice of that product (with its
 * approved profile) and the queued recompute books the declared figures. Test data only.
 */
describe('declared mode: the policy accounting product (two profiles, no plan)', () => {
  const env = new AccountingWorld();
  let periodId = '';

  const policy = (version: number, accountingProductId: string | null) =>
    env.rows(
      `INSERT INTO accounting_policies (tenant_id, row_version, policy_kind, unit_id, scope_key, version, body,
              effective_from, approved_at)
       VALUES ($1, 1, 'loss_accounting', $2::uuid, $2, $3, $4::jsonb, '2026-01-01T00:00:00Z', now())`,
      [
        env.world.tenantA,
        env.world.unitA1,
        version,
        JSON.stringify({ ...POLICY, accountingProductId }),
      ],
    );

  beforeAll(async () => {
    await env.start();
    await env.rows(
      `UPDATE reason_codes SET default_oee_component = 'availability' WHERE id = $1`,
      [env.world.reasonR1],
    );
    await policy(1, null);
    await env.materialize([env.world.unitA1]);
    periodId = await env.periodId(env.world.unitA1, A);
  });
  afterAll(() => env.stop());

  it('two profiles and no accounting product: no slice, ambiguous_default_product', async () => {
    const detail = await env.detail(periodId);
    expect(detail.data.slices).toEqual([]);
    expect(detail.data.warnings.map((w) => w.code)).toContain(
      'ambiguous_default_product',
    );
  });

  it('the accounting product gives one slice and a validated run with the declared figures', async () => {
    await policy(2, env.products.p2);
    const again = await env.materialize([env.world.unitA1]);
    expect(again.created).toBe(0);
    const slices = await env.rows<{
      product_id: string;
      profile_id: string | null;
      window_from: Date;
      window_to: Date;
    }>(
      `SELECT product_id, profile_id, window_from, window_to FROM period_product_slices
        WHERE period_id = $1 AND superseded_at IS NULL`,
      [periodId],
    );
    expect(slices).toHaveLength(1);
    expect(slices[0].product_id).toBe(env.products.p2);
    expect(new Date(slices[0].window_from).toISOString()).toBe(A);
    expect(new Date(slices[0].window_to).toISOString()).toBe(B);
    const [profile] = await env.rows<{ id: string }>(
      `SELECT id FROM production_profiles WHERE unit_id = $1 AND product_id = $2 AND state = 'approved'`,
      [env.world.unitA1, env.products.p2],
    );
    expect(slices[0].profile_id).toBe(profile.id);

    await env
      .post('production-events', {
        unitId: env.world.unitA1,
        startTime: A,
        endTime: B,
        physicalType: 'production_loss',
        reasonCodeId: env.world.reasonR1,
        declaredFigures: {
          planned: 240,
          actual: 208,
          shortfall: 32,
          sourceStatus: 'CONFIRMED',
        },
      })
      .expect(201);
    await env.settle();
    const body = await env.accounting(periodId);
    expect(body.data.run).toMatchObject({ status: 'validated' });
    expect(env.totals(body, 'plan')).toMatchObject({
      target: '240',
      actual: '208',
      gap: '32',
      attributed: '32',
      residual: '0',
    });
  });
});

/**
 * A tenant-wide declared policy whose accounting unit is A2: only A2's periods run the declared ledger;
 * A1 (another unit of the plant) keeps the computed ledger, so its stop still produces a loss line and its
 * run snapshot reads `computed` for the gates. Test data only.
 */
describe('declared mode is limited to the accounting unit', () => {
  const env = new AccountingWorld();
  let declaredPeriod = '';
  let computedPeriod = '';
  let stopId = '';
  let lossId = '';

  beforeAll(async () => {
    await env.start();
    const { unitA1, unitA2 } = env.world;
    await env.approvedPlan(unitA1);
    await env.approvedPlan(unitA2);
    await env.materialize([unitA1, unitA2]);
    declaredPeriod = await env.periodId(unitA2, A);
    computedPeriod = await env.periodId(unitA1, A);
    await env.rows(
      `UPDATE reason_codes SET default_oee_component = 'availability' WHERE id = $1`,
      [env.world.reasonR1],
    );
    await env.rows(
      `INSERT INTO accounting_policies (tenant_id, row_version, policy_kind, unit_id, scope_key, version, body,
              effective_from, approved_at)
       VALUES ($1, 1, 'loss_accounting', NULL, 'tenant', 2, $2::jsonb, '2026-01-01T00:00:00Z', now())`,
      [
        env.world.tenantA,
        JSON.stringify({ ...POLICY, accountingUnitId: unitA2 }),
      ],
    );
    await env.outputEvent(unitA1, A, B, '300');
    await env.outputEvent(unitA2, A, B, '300');
    stopId = await env.lossEvent(unitA1, plus(A, HOUR), 1, {
      reasonCodeId: env.world.reasonR1,
    });
    const created = await env
      .post('production-events', {
        unitId: unitA2,
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

  it('the accounting unit runs the declared ledger', async () => {
    const body = await env.accounting(declaredPeriod);
    expect(body.data.totals.map((t) => t.ledger)).toEqual(['plan']);
    const lines = body.data.lines.filter((l) => l.kind !== 'residual');
    expect(lines).toMatchObject([{ basis: 'declared', causeEventId: lossId }]);
  });

  it('another unit runs computed: its stop produces a line and no capacity_not_applicable flag', async () => {
    const body = await env.accounting(computedPeriod);
    expect(body.data.run).toMatchObject({ status: 'validated' });
    const stopLines = body.data.lines.filter((l) => l.causeEventId === stopId);
    expect(stopLines.length).toBeGreaterThan(0);
    expect(stopLines.every((l) => l.basis !== 'declared')).toBe(true);
    expect(env.totals(body, 'plan').flags).not.toContain(
      'capacity_not_applicable',
    );
  });
});
