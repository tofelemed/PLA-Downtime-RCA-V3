import { randomUUID } from 'crypto';
import { Dec } from '../../src/domain/actuals/decimal';
import { A, B, HOUR, NEXT_DAY } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';
import { DAY1, DAY3, DAY3_A_END } from './support/plan-world';

interface KpiRow {
  metric: string;
  numerator: string | null;
  denominator: string | null;
  value: string | null;
  quality: string;
  reason: string | null;
  cohort: Record<string, unknown> | null;
}

interface Aggregate {
  metric: string;
  numerator: string | null;
  denominator: string | null;
  value: string | null;
  quality: string;
  reason: string | null;
}

/**
 * Plan 2.7 on real Postgres: a calculation run writes its KPI results (operational and reconciled OEE,
 * downtime, reliability) with explicit terms; results are immutable; the v1 `oee_summaries_v` reads them;
 * the failure view follows D13. Unit A3 (one profile → default-product slices, sustained 100 t/h): shift A
 * of 1 Mar (S 8 h, 1 h coded unplanned stop, 300 t) and shift A of 3 Mar after its 1 h planned shutdown
 * (S 7 h, 630 t). Test data only.
 */
describe('KPI results of calculation runs (plan 2.7)', () => {
  const env = new AccountingWorld();
  let periodA = '';
  let periodDay3 = '';
  let assetId = '';

  const kpis = (periodId: string, level = 'period') =>
    env.rows<KpiRow>(
      `SELECT k.metric::text AS metric, k.numerator::text AS numerator, k.denominator::text AS denominator,
              k.value::text AS value, k.quality::text AS quality, k.reason, k.cohort
         FROM kpi_results k JOIN accounting_revisions ar ON ar.current_run_id = k.run_id
        WHERE ar.period_id = $1 AND k.scope->>'level' = $2`,
      [periodId, level],
    );
  const metric = (rows: KpiRow[], name: string) => {
    const found = rows.find((r) => r.metric === name);
    if (!found) throw new Error(`no ${name}`);
    return found;
  };
  const eq = (actual: string | null, expected: string) =>
    actual !== null && new Dec(actual).minus(expected).abs().lt('0.0000001');

  beforeAll(async () => {
    await env.start();
    const unit = env.world.unitA3;
    assetId = randomUUID();
    await env.rows(
      `INSERT INTO assets (id, code, name, unit_id, tenant_id) VALUES ($1, 'EXT-1', 'Extruder 1', $2, $3)`,
      [assetId, unit, env.world.tenantA],
    );
    await env.materialize([unit], DAY1, NEXT_DAY);
    await env.materialize([unit], DAY3, DAY3_A_END);
    periodA = await env.periodId(unit, A);
    // the 1 h planned shutdown splits shift A of 3 Mar: the 7 h remainder is its own period
    periodDay3 = await env.periodId(unit, plus(DAY3, HOUR));
    await env.outputEvent(unit, A, B, '300');
    await env.outputEvent(unit, plus(DAY3, HOUR), DAY3_A_END, '630');
    const stop = await env.lossEvent(unit, plus(A, HOUR), 1, {
      scheduleClass: 'unplanned',
      oeeComponent: 'availability',
      assetId,
    });
    await env.rows(
      `UPDATE production_events SET failure_mode = 'BRG' WHERE id = $1`,
      [stop],
    );
    await env.settle();
  });
  afterAll(() => env.stop());

  it('writes operational OEE with explicit terms (KPI01): A 87.5 %, P = U/R, Q, OEE = V/S', async () => {
    const rows = await kpis(periodA);
    expect(metric(rows, 'availability')).toMatchObject({
      numerator: '25200.00000000',
      denominator: '28800.00000000',
    });
    expect(eq(metric(rows, 'availability').value, '0.875')).toBe(true);
    // U = 300 t / 100 t/h = 10 800 s; P = 10 800 / 25 200
    expect(metric(rows, 'performance').numerator).toBe('10800.00000000');
    expect(eq(metric(rows, 'performance').value, '0.4285714286')).toBe(true);
    expect(eq(metric(rows, 'oee').value, '0.375')).toBe(true);
    const slice = await kpis(periodA, 'slice');
    expect(eq(metric(slice, 'oee').value, '0.375')).toBe(true);
  });

  it('reconciled PLA OEE from the capacity ledger, labelled (KPI04)', async () => {
    const rows = await kpis(periodA);
    const oee = metric(rows, 'reconciled_oee');
    expect(eq(oee.value, '0.375')).toBe(true);
    expect(oee.cohort).toMatchObject({ label: 'Reconciled PLA OEE', uom: 't' });
  });

  it('downtime and reliability (KPI05–KPI08): coded unplanned stop is a failure; MTTR needs repair evidence', async () => {
    const rows = await kpis(periodA);
    expect(metric(rows, 'downtime_total').value).toBe('3600.0000000000');
    expect(metric(rows, 'stop_count').value).toBe('1.0000000000');
    expect(eq(metric(rows, 'mtbf').value, '25200')).toBe(true);
    expect(eq(metric(rows, 'mean_downtime_to_restore').value, '3600')).toBe(
      true,
    );
    expect(metric(rows, 'mttr')).toMatchObject({
      value: null,
      reason: 'repair_evidence_missing',
      quality: 'unavailable',
    });
    const asset = await kpis(periodA, 'asset');
    expect(asset.map((r) => r.metric).sort()).toEqual([
      'mean_downtime_to_restore',
      'mtbf',
      'mttr',
    ]);
    const failures = await env.rows<{ source: string; asset_id: string }>(
      `SELECT source, asset_id FROM failure_events_v WHERE unit_id = $1`,
      [env.world.unitA3],
    );
    expect(failures).toEqual([
      { source: 'unplanned_stop_with_failure_code', asset_id: assetId },
    ]);
  });

  it('the exclusion shortens S (3 Mar shift A: 7 h); no failure → mtbf null with exposure', async () => {
    const rows = await kpis(periodDay3);
    expect(metric(rows, 'availability').denominator).toBe('25200.00000000');
    expect(eq(metric(rows, 'oee').value, '0.9')).toBe(true);
    expect(metric(rows, 'mtbf')).toMatchObject({
      value: null,
      reason: 'no_failures',
      numerator: '25200.00000000',
      denominator: '0.00000000',
    });
  });

  it('kpi_results are immutable', async () => {
    await expect(
      env.rows(`UPDATE kpi_results SET value = 1 WHERE period_id = $1`, [
        periodA,
      ]),
    ).rejects.toThrow(/immutable/);
    await expect(
      env.rows(`DELETE FROM kpi_results WHERE period_id = $1`, [periodA]),
    ).rejects.toThrow(/immutable/);
  });

  it('v1 oee_summaries_v shows the period KPIs as legacy percentages and minutes', async () => {
    const [row] = await env.rows<Record<string, string | null>>(
      `SELECT availability::text, oee::text, planned_production_time::text, downtime::text
         FROM oee_summaries_v WHERE period_id = $1`,
      [periodA],
    );
    expect(row).toEqual({
      availability: '87.50',
      oee: '37.50',
      planned_production_time: '480.00',
      downtime: '60.00',
    });
  });

  describe('GET /v2/reports/oee (AN03, T31)', () => {
    const report = async (query: string, token = env.admin) =>
      (await env.get(`reports/oee?${query}`, token).expect(200)).body as {
        data: {
          label: string;
          groups: Array<{ key: string; metrics: Aggregate[] }>;
          total: Aggregate[];
          calculationRunIds: string[];
        };
        calculationRunId: string | null;
        policyVersion: string | null;
        isProvisional: boolean;
        dataQuality: { missingCount: number; provisionalCount: number };
        coverage: { ratio: number };
        scope: { unitIds: string[] };
      };
    const window = `from=${encodeURIComponent(DAY1)}&to=${encodeURIComponent(DAY3_A_END)}&unitIds=`;

    it('sums numerators and denominators: (10 800 + 22 680) / (28 800 + 25 200) = 62 %, not the 63.75 % mean', async () => {
      const body = await report(`${window}${env.world.unitA3}&groupBy=period`);
      const oee = body.data.total.find((t) => t.metric === 'oee')!;
      expect(oee.numerator).toBe('33480');
      expect(oee.denominator).toBe('54000');
      expect(oee.value).toBe('0.62');
      // shifts B / C of 1 Mar and 3 Mar have no actuals: missing, so the total is provisional
      expect(oee).toMatchObject({
        quality: 'provisional',
        reason: 'incomplete_periods',
      });
      expect(body.data.label).toBe('Operational OEE (ISO 22400)');
      expect(body.policyVersion).toBe('oee_policy@1');
      expect(body.isProvisional).toBe(true);
      expect(body.data.calculationRunIds.length).toBeGreaterThanOrEqual(2);
      const periods = body.data.groups.map((g) => g.key);
      expect(periods).toEqual(expect.arrayContaining([periodA, periodDay3]));
    });

    it('reconciled policy is labelled; approvedOnly shows nothing unapproved', async () => {
      const reconciled = await report(
        `${window}${env.world.unitA3}&policy=reconciled&groupBy=unit`,
      );
      expect(reconciled.data.label).toBe('Reconciled PLA OEE');
      expect(reconciled.data.total.map((t) => t.metric)).toContain(
        'reconciled_oee',
      );
      const approved = await report(
        `${window}${env.world.unitA3}&approvedOnly=true`,
      );
      expect(approved.data.calculationRunIds).toEqual([]);
      expect(approved.coverage.ratio).toBe(0);
      expect(approved.data.total.find((t) => t.metric === 'oee')).toMatchObject(
        {
          value: null,
          quality: 'unavailable',
        },
      );
    });
  });

  describe('downtime and reliability reports', () => {
    const window = `from=${encodeURIComponent(DAY1)}&to=${encodeURIComponent(DAY3_A_END)}&unitIds=`;

    it('downtime by OEE component and day; frequency counts occurrences', async () => {
      const byComponent = await env
        .get(`reports/downtime?${window}${env.world.unitA3}&groupBy=oee`)
        .expect(200);
      expect(byComponent.body.data).toMatchObject({
        total: '3600',
        groups: [{ key: 'availability', value: '3600', share: '1' }],
      });
      const frequency = await env
        .get(
          `reports/downtime?${window}${env.world.unitA3}&groupBy=day&metric=frequency`,
        )
        .expect(200);
      expect(frequency.body.data.groups).toEqual([
        expect.objectContaining({ key: '2027-03-01', value: '1' }),
      ]);
      const planned = await env
        .get(
          `reports/downtime?${window}${env.world.unitA3}&groupBy=asset&scheduleClass=planned`,
        )
        .expect(200);
      expect(planned.body.data.total).toBe('0');
    });

    it('reliability per unit and asset: MTBF from exposure / failures, MTTR null without repair evidence', async () => {
      const response = await env
        .get(
          `reports/reliability?${window}${env.world.unitA3}&assetIds=${assetId}`,
        )
        .expect(200);
      const data = response.body.data as {
        units: Array<{
          unitId: string;
          exposureSeconds: string;
          failures: string;
          mtbf: Aggregate;
          mttr: Aggregate;
        }>;
        assets: Array<{
          assetId: string;
          label: string;
          failures: string;
          mtbf: Aggregate;
        }>;
      };
      const unit = data.units.find((u) => u.unitId === env.world.unitA3)!;
      expect(unit.failures).toBe('1');
      expect(unit.mtbf.value).toBe(unit.exposureSeconds);
      expect(unit.mttr).toMatchObject({
        value: null,
        reason: 'repair_evidence_missing',
      });
      expect(data.assets).toEqual([
        expect.objectContaining({
          assetId,
          label: 'Extruder 1',
          failures: '1',
        }),
      ]);
    });
  });
});
