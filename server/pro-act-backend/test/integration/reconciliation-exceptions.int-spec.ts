import { A, B, C, HOUR, NEXT_DAY } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { DAY1 } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';

interface ExceptionItem {
  id: string;
  type: string;
  periodId: string;
  unitId: string;
  workflowState: string;
  count: number;
  message: string;
  target: Record<string, string>;
}

interface Page {
  items: ExceptionItem[];
  nextCursor: string | null;
  scope: { tenantId: string; unitIds?: string[] };
}

interface PeriodState {
  period_id: string;
  revision_id: string;
  run_id: string;
  actuals_run_id: string | null;
}

const WINDOW = 'fromDate=2027-03-01&toDate=2027-03-02';

/**
 * Plan 2.4 on real Postgres, on the 2.8 world (unit A1: plan 1000 t per shift, output 850 t, so the engine
 * flags each shift's 150 t residual as unaccounted) plus unit A3's calculated periods of 1 Mar 2027. The other
 * stored states — slice flags, the stale mark, the substitution flag, a duplicate-stop suggestion — are
 * written directly as the engine, the workflow, the actuals runner and the stop reconciliation store them
 * (test data only). Also the filters, the keyset and the request-context scope.
 */
describe('Accounting exceptions queue (plan 2.4)', () => {
  const env = new ReconciliationWorld();
  const periods = new Map<string, PeriodState>();
  const list = async (query = '', token = env.admin) =>
    (
      await env
        .get(`reconciliation/exceptions?${WINDOW}${query}`, token)
        .expect(200)
    ).body as Page;
  const find = (page: Page, periodId: string, type: string) =>
    page.items.find((i) => i.periodId === periodId && i.type === type);
  const state = (unit: string, start: string) => {
    const found = periods.get(`${unit}@${start}`);
    if (!found) throw new Error(`no period ${unit}@${start}`);
    return found;
  };

  async function load(unitId: string, start: string): Promise<void> {
    const [row] = await env.rows<PeriodState>(
      `SELECT p.id AS period_id, r.id AS revision_id, r.current_run_id AS run_id, cr.actuals_run_id
         FROM production_periods p
         JOIN LATERAL (SELECT ar.id, ar.current_run_id FROM accounting_revisions ar
                        WHERE ar.period_id = p.id AND ar.lifecycle <> 'cancelled'
                        ORDER BY ar.revision DESC LIMIT 1) r ON true
         LEFT JOIN calculation_runs cr ON cr.id = r.current_run_id
        WHERE p.unit_id = $1 AND p.utc_start = $2`,
      [unitId, start],
    );
    if (!row?.run_id)
      throw new Error(`no calculated period ${unitId}@${start}`);
    periods.set(`${unitId}@${start}`, row);
  }

  async function flag(runId: string, ledger: string, flags: string[]) {
    // test data only: the totals are immutable in production (a recalculation writes a new run)
    await env.rows(
      `ALTER TABLE period_ledger_totals DISABLE TRIGGER trg_period_ledger_totals_immutable`,
    );
    const rows = await env.rows<{ id: string }>(
      `UPDATE period_ledger_totals SET flags = $3::jsonb WHERE run_id = $1 AND ledger = $2 RETURNING id`,
      [runId, ledger, JSON.stringify(flags)],
    );
    await env.rows(
      `ALTER TABLE period_ledger_totals ENABLE TRIGGER trg_period_ledger_totals_immutable`,
    );
    if (rows.length === 0)
      throw new Error(`no ${ledger} totals in run ${runId}`);
  }

  async function storedState(): Promise<void> {
    const { unitA1, unitA3 } = env.world;
    await flag(state(unitA1, C).run_id, 'capacity', [
      'claim_exceeds_component',
    ]);
    await flag(state(unitA1, C).run_id, 'plan', [
      'bridge_required',
      'plan_allocation_required',
    ]);
    await env.rows(
      `UPDATE accounting_revisions SET lifecycle = 'in_review', is_stale = true, stale_reason = 'events changed'
        WHERE id = $1`,
      [state(unitA1, A).revision_id],
    );
    const actualsRun = state(unitA3, C).actuals_run_id;
    await env.rows(
      `ALTER TABLE actuals_results DISABLE TRIGGER trg_actuals_results_immutable`,
    );
    await env.rows(
      `UPDATE actuals_results SET substitution = '{"used":{"label":"Silo level"},"replaced":{},"reason":"no_measured_source","crossBoundary":null}'::jsonb
        WHERE actuals_run_id = $1`,
      [actualsRun],
    );
    await env.rows(
      `ALTER TABLE actuals_results ENABLE TRIGGER trg_actuals_results_immutable`,
    );
    const kept = await env.lossEvent(unitA1, plus(B, 2 * HOUR), 1, {
      reasonCodeId: await env.reasonCode('DUP'),
    });
    const evidence = await env.lossEvent(
      unitA1,
      plus(B, 2 * HOUR + 30_000),
      1,
      { reasonCodeId: await env.reasonCode('DUP2') },
    );
    await env.rows(
      `INSERT INTO stop_reconciliations (tenant_id, unit_id, kept_event_id, evidence_event_id, state, mode,
                                         suggestion_reason, start_delta_seconds, end_delta_seconds, tolerance_seconds, row_version)
       VALUES ($1, $2, $3, $4, 'suggested', 'manual', 'same_source', 30, 30, 120, 1)
       ON CONFLICT DO NOTHING`,
      [env.world.tenantA, unitA1, kept, evidence],
    );
  }

  beforeAll(async () => {
    await env.start();
    const { unitA1, unitA3 } = env.world;
    await env.materialize([unitA3], DAY1, NEXT_DAY);
    await env.lossEvent(unitA1, plus(A, HOUR), 1, {
      scheduleClass: 'unplanned',
    });
    await env.lossEvent(unitA3, plus(A, HOUR), 1, {
      scheduleClass: 'unplanned',
    });
    await env.settle();
    // every shift of both units calculated, also those without a changed event (A3 shifts B / C)
    const recalc = await env.post('production-periods/recalculate', {
      unitIds: [unitA1, unitA3],
      from: DAY1,
      to: NEXT_DAY,
    });
    expect(recalc.status).toBeLessThan(300);
    await env.settle();
    for (const unit of [unitA1, unitA3]) {
      for (const start of [A, B, C]) await load(unit, start);
    }
    await storedState();
  });
  afterAll(() => env.stop());

  it('residual beyond tolerance: from the latest run’s plan totals, linked to the period reconciliation', async () => {
    const page = await list('&types=residual_beyond_tolerance');
    const item = find(
      page,
      state(env.world.unitA1, B).period_id,
      'residual_beyond_tolerance',
    );
    expect(item?.message).toMatch(
      /^Residual 150( t)? beyond tolerance in the latest calculation$/,
    );
    expect(item?.target).toMatchObject({
      screen: 'period',
      section: 'reconciliation',
    });
    expect(
      page.items.every((i) => i.type === 'residual_beyond_tolerance'),
    ).toBe(true);
  });

  it('claim_exceeds_component, bridge_required and plan_allocation_required: one row per period and type', async () => {
    const page = await list(
      '&types=claim_exceeds_component&types=bridge_required&types=plan_allocation_required',
    );
    const periodC = state(env.world.unitA1, C).period_id;
    for (const type of [
      'claim_exceeds_component',
      'bridge_required',
      'plan_allocation_required',
    ]) {
      expect(find(page, periodC, type)).toMatchObject({ count: 1 });
    }
  });

  it('stale submission: in review and stale, linked to Review & close', async () => {
    const page = await list('&types=stale_submission');
    const item = find(
      page,
      state(env.world.unitA1, A).period_id,
      'stale_submission',
    );
    expect(item).toMatchObject({
      workflowState: 'stale',
      message: 'The submitted reconciliation is stale: events changed',
    });
    expect(item?.target).toMatchObject({ screen: 'period', section: 'review' });
  });

  it('actuals on a substitute source: from the latest run’s actuals results', async () => {
    const page = await list('&types=substitute_source');
    const item = find(
      page,
      state(env.world.unitA3, C).period_id,
      'substitute_source',
    );
    expect(item?.message).toContain('substitute source (Silo level)');
  });

  it('uncoded stop time: live stops of the period without a reason, linked to the Event Hub', async () => {
    const page = await list('&types=uncoded_stop_time');
    const item = find(
      page,
      state(env.world.unitA1, A).period_id,
      'uncoded_stop_time',
    );
    expect(item).toMatchObject({
      count: 1,
      message: '1 stop without a reason in this period',
    });
    expect(item?.target).toMatchObject({
      screen: 'events',
      unitId: env.world.unitA1,
      filter: 'uncoded',
    });
  });

  it('pending duplicate-merge suggestions on the period’s unit and window', async () => {
    const page = await list('&types=duplicate_merge_pending');
    const item = find(
      page,
      state(env.world.unitA1, B).period_id,
      'duplicate_merge_pending',
    );
    expect(item?.count).toBeGreaterThanOrEqual(1);
    expect(['stop_merge', 'stop_merges']).toContain(item?.target.screen);
  });

  it('filters by workflow state and unit', async () => {
    const stale = await list('&workflowStates=stale');
    expect(stale.items.length).toBeGreaterThan(0);
    expect(stale.items.every((i) => i.workflowState === 'stale')).toBe(true);
    const a3 = await list(`&unitIds=${env.world.unitA3}`);
    expect(a3.items.every((i) => i.unitId === env.world.unitA3)).toBe(true);
  });

  it('pages with a keyset cursor: every row once, in period order', async () => {
    const all = await list('&limit=200');
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: Page = await list(
        `&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      seen.push(...page.items.map((i) => i.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(all.items.map((i) => i.id));
    await env
      .get(`reconciliation/exceptions?${WINDOW}&cursor=not-a-cursor`)
      .expect(400);
  });

  it('scope: a unit-limited user sees its unit only; foreign units are 422; another tenant sees nothing', async () => {
    const a3Only = await env.unitUser(env.world.unitA3);
    const own = await list('', a3Only);
    expect(own.items.length).toBeGreaterThan(0);
    expect(own.items.every((i) => i.unitId === env.world.unitA3)).toBe(true);
    expect(own.scope.unitIds).toEqual([env.world.unitA3]);
    await env
      .get(
        `reconciliation/exceptions?${WINDOW}&unitIds=${env.world.unitA1}`,
        a3Only,
      )
      .expect(422);
    const other = await list('', env.adminB);
    expect(other.items).toEqual([]);
  });

  it('rejects a reversed or too long window and unknown types', async () => {
    await env
      .get('reconciliation/exceptions?fromDate=2027-03-02&toDate=2027-03-01')
      .expect(422);
    await env
      .get('reconciliation/exceptions?fromDate=2026-01-01&toDate=2027-03-01')
      .expect(422);
    await env
      .get(`reconciliation/exceptions?${WINDOW}&types=everything`)
      .expect(422); // v2 validation failures are 422 VALIDATION_FAILED
    await env
      .get(`reconciliation/exceptions?${WINDOW}&tenantId=${env.world.tenantA}`)
      .expect(400);
  });
});
