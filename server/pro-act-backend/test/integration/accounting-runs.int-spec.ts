import { AccountingRunService } from '../../src/accounting/accounting-run.service';
import { Dec } from '../../src/domain/actuals/decimal';
import { A, B, HOUR } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';
import { DAY3, DAY3_A_END } from './support/plan-world';

/**
 * Plan 2.5 calculation runs on real Postgres: a recompute runs actuals first and then both ledgers into
 * the period's draft revision; lines carry evidence (event revision, share), rate versions and
 * deterministic keys; identical inputs create no run; a changed input writes a new run, supersedes the
 * old one and switches the pointer atomically (a concurrent reader sees old or new); a failed
 * validation keeps the previous run; lines are immutable; v1 compatibility views read the plan ledger.
 */
describe('loss accounting calculation runs (plan 2.5)', () => {
  const env = new AccountingWorld();
  let periodA1 = '';
  let firstRun = '';
  let stopId = '';

  beforeAll(async () => {
    await env.start();
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    periodA1 = await env.periodId(env.world.unitA1, A);
    await env.outputEvent(env.world.unitA1, A, B, '300');
    stopId = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1);
    await env.settle();
  });
  afterAll(() => env.stop());

  it('computes both ledgers into a draft revision with evidence and rate versions', async () => {
    const body = await env.accounting(periodA1);
    expect(body.data.revision).toMatchObject({
      revision: 1,
      lifecycle: 'draft',
    });
    expect(body.data.run).toMatchObject({ status: 'validated' });
    expect(body.calculationRunId).toBe(body.data.run?.id);
    expect(body.policyVersion).toBe(
      'oee_policy@1,reconciliation_tolerance@1,valuation_basis@1',
    );
    expect(body.data.defaultLedgerView).toBe('plan');
    expect(body.isProvisional).toBe(true);
    firstRun = body.data.run!.id;
    expect(env.totals(body, 'capacity')).toMatchObject({
      capacity: '800',
      exclusion: '0',
      availability: '100',
      performance: '400',
      quality: '0',
      good: '300',
      residual: '0',
    });
    const stop = body.data.lines.find(
      (l) => l.ledger === 'capacity' && l.kind === 'availability',
    )!;
    expect(stop).toMatchObject({
      quantity: '100',
      basis: 'sustained_rate',
      causeEventId: stopId,
    });
    expect(stop.rateVersionId).not.toBeNull();
    expect(stop.evidence).toEqual([
      expect.objectContaining({ eventId: stopId, share: '1' }),
    ]);
    expect(stop.evidence[0].eventRevisionId).not.toBeNull();
  });

  it('plan ledger: target from the plan period, the stop at the planned rate, recovery as a gain (SME Q1 / Q2)', async () => {
    const [{ target }] = await env.rows<{ target: string }>(
      `SELECT pp.target::text AS target FROM plan_periods pp JOIN period_product_slices s ON s.plan_period_id = pp.id
        WHERE s.period_id = $1 AND s.superseded_at IS NULL`,
      [periodA1],
    );
    const plan = env.totals(await env.accounting(periodA1), 'plan');
    const gap = new Dec(target).minus(300);
    expect(new Dec(plan.gap!).eq(gap)).toBe(true);
    // planned rate = target ÷ 8 eligible h; the 1 h stop costs one hour of it
    const plannedRate = new Dec(target).div(8);
    expect(
      new Dec(plan.availability!).minus(plannedRate).abs().lte('0.00000001'),
    ).toBe(true);
    // 300 t beat the planned running capacity (target − stop): the excess is a recovery gain
    const gain = new Dec(300).minus(new Dec(target).minus(plannedRate));
    expect(new Dec(plan.gain!).minus(gain).abs().lte('0.00000002')).toBe(true);
    expect(new Dec(plan.attributed!).minus(gap).abs().lte('0.00000002')).toBe(
      true,
    );
    expect(plan.residual).toBe('0');
    expect(plan.flags).toContain('planned_rate_scaled');
    expect(plan.flags).not.toContain('over_accounted');
    // UX D-2: the line stores the scaled rate it was computed with, per its timebase
    const [planStop] = await env.rows<{ rate: string; timebase: string }>(
      `SELECT applied_rate::text AS rate, applied_rate_timebase AS timebase FROM loss_lines
        WHERE run_id = $1 AND ledger = 'plan' AND kind = 'availability'`,
      [firstRun],
    );
    const perHour: Record<string, number> = {
      s: 3600,
      min: 60,
      h: 1,
      d: 1 / 24,
    };
    expect(perHour[planStop.timebase]).toBeDefined();
    const appliedPerHour = new Dec(planStop.rate).mul(
      perHour[planStop.timebase],
    );
    expect(appliedPerHour.minus(plannedRate).abs().lte('0.00000001')).toBe(
      true,
    );
  });

  it('identical inputs create no run (T44: the actuals run is reused too)', async () => {
    await env.post(`production-periods/${periodA1}/recompute`, {}).expect(202);
    await env.runActuals();
    const [job] = await env.rows<{
      result: {
        reused: boolean;
        calculation: string;
        calculationRunId: string;
      };
    }>(
      `SELECT result FROM actuals_jobs WHERE period_id = $1 AND request->>'trigger' = 'manual_recompute'`,
      [periodA1],
    );
    expect(job.result).toMatchObject({
      reused: true,
      calculation: 'unchanged',
      calculationRunId: firstRun,
    });
    expect(await env.runs(periodA1)).toHaveLength(1);
  });

  it('a changed loss event writes a new run, supersedes the old one and keeps it intact', async () => {
    const before = await env.accounting(periodA1);
    const later = await env.lossEvent(env.world.unitA1, plus(A, 1.5 * HOUR), 1);
    await env.settle();
    const after = await env.accounting(periodA1);
    expect(after.data.run!.id).not.toBe(firstRun);
    expect(after.data.run!.actualsRunId).toBe(before.data.run!.actualsRunId);
    expect(env.totals(after, 'capacity')).toMatchObject({
      availability: '150',
      residual: '0',
    });
    // SME D7 first-out: the first stop keeps its whole hour, the later one only the time after it
    const byCause = (eventId: string) =>
      after.data.lines.find(
        (l) =>
          l.ledger === 'capacity' &&
          l.kind === 'availability' &&
          l.causeEventId === eventId,
      );
    expect(byCause(stopId)).toMatchObject({ quantity: '100' });
    expect(byCause(later)?.quantity).toBe('50');
    const runs = await env.runs(periodA1);
    expect(runs.map((r) => r.status)).toEqual(['validated', 'superseded']);
    const [{ count }] = await env.rows<{ count: number }>(
      `SELECT count(*)::int AS count FROM loss_lines WHERE run_id = $1`,
      [firstRun],
    );
    expect(count).toBe(before.data.lines.length);
  });

  it('switches the draft pointer atomically: a concurrent reader sees the old run until commit', async () => {
    const old = (await env.accounting(periodA1)).data.run!.id;
    await env.lossEvent(env.world.unitA1, plus(A, 5 * HOUR), 0.5);
    const runner = env.harness.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const outcome = await env.app
        .get(AccountingRunService)
        .runIn(runner.manager, periodA1, { reason: 'test', requestedBy: null });
      expect(outcome.calculation).toBe('validated');
      const during = await env.accounting(periodA1);
      expect(during.data.run!.id).toBe(old);
      await runner.commitTransaction();
      const after = await env.accounting(periodA1);
      expect(after.data.run!.id).toBe(outcome.calculationRunId);
      expect(env.totals(after, 'capacity').residual).toBe('0');
    } finally {
      await runner.release();
    }
    await env.settle();
  });

  it('loss lines, evidence and totals are immutable', async () => {
    await expect(
      env.rows(`UPDATE loss_lines SET comment = 'x' WHERE run_id = $1`, [
        firstRun,
      ]),
    ).rejects.toThrow(/immutable/);
    await expect(
      env.rows(`DELETE FROM period_ledger_totals WHERE run_id = $1`, [
        firstRun,
      ]),
    ).rejects.toThrow(/immutable/);
  });

  it('v1 compatibility views read the plan ledger of the shown run', async () => {
    const body = await env.accounting(periodA1);
    const plan = env.totals(body, 'plan');
    const [row] = await env.rows<{
      losses: string;
      unaccounted_loss: string;
      calculation_run_id: string;
    }>(
      `SELECT losses::text, unaccounted_loss::text, calculation_run_id FROM production_losses_v WHERE period_id = $1`,
      [periodA1],
    );
    expect(row.calculation_run_id).toBe(body.data.run!.id);
    expect(new Dec(row.losses).eq(plan.attributed!)).toBe(true);
    expect(new Dec(row.unaccounted_loss).eq(plan.residual!)).toBe(true);
    const categories = await env.rows(
      `SELECT 1 FROM loss_categories_v WHERE period_id = $1`,
      [periodA1],
    );
    const planLines = body.data.lines.filter(
      (l) => l.ledger === 'plan' && l.kind !== 'residual',
    );
    expect(categories).toHaveLength(planLines.length);
  });

  it('a claim beyond its component completes the run, flagged for reconciliation (LA-02)', async () => {
    const current = (await env.accounting(periodA1)).data.run!.id;
    await env.lossEvent(env.world.unitA1, plus(A, 3 * HOUR), 0.25, {
      physicalType: 'quality_loss',
      quantity: '10',
      quantityUom: 't',
    });
    await env.settle();
    const runs = await env.runs(periodA1);
    expect(runs[0]).toMatchObject({ status: 'validated' });
    const body = await env.accounting(periodA1);
    expect(body.data.run!.id).not.toBe(current);
    const capacity = env.totals(body, 'capacity');
    expect(capacity.flags).toContain('claim_exceeds_component');
    expect(capacity.residual).toBe('-10');
    expect(env.totals(body, 'plan').flags).toContain('bridge_required');
  });

  it('an excluded period is schedule exclusion only; missing actuals leave the residual null', async () => {
    await env.materialize([env.world.unitA3], DAY3, DAY3_A_END);
    const excluded = await env.periodId(env.world.unitA3, DAY3);
    await env.recompute(excluded);
    const capacity = env.totals(await env.accounting(excluded), 'capacity');
    expect(capacity).toMatchObject({
      capacity: '100',
      exclusion: '100',
      availability: '0',
      residual: null,
    });
    expect(capacity.flags).toContain('actuals_missing');
  });

  it('views: an unknown revision or a missing approved revision is 404', async () => {
    await env
      .get(`production-periods/${periodA1}/accounting?view=approved`)
      .expect(404);
    await env
      .get(`production-periods/${periodA1}/accounting?revision=9`)
      .expect(404);
    const draft = await env.accounting(periodA1, env.admin, '?view=draft');
    expect(draft.data.revision?.lifecycle).toBe('draft');
  });
});
