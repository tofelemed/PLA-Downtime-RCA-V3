import { randomUUID } from 'crypto';
import { A, HOUR, NEXT_DAY } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';
import { ApiError, DAY1 } from './support/plan-world';

interface GroupBody {
  key: string | null;
  label: string | null;
  value: string;
  share: string | null;
  cumulativeShare: string | null;
}

interface SummaryBody {
  metric: string;
  value: string | null;
  quality: string;
  reason: string | null;
}

interface DowntimeBody {
  data: {
    groupBy: string;
    parentReasonId: string | null;
    groups: GroupBody[];
    total: string;
    summary: SummaryBody[];
    calculationRunIds: string[];
  };
}

interface BundleBody {
  data: {
    summary: SummaryBody[];
    views: Array<{
      view: string;
      metric: string;
      scheduleClass: string | null;
      groups: GroupBody[];
      total: string;
    }>;
    calculationRunIds: string[];
  };
}

/**
 * Plan 3.3 additions to `GET /v2/reports/downtime` on real Postgres: the cumulative share of the Pareto,
 * the reason drill-down (`groupBy=reasonChild` + `parentReasonId`, subtree restriction of the reason
 * groupings), the period KPI summary, and the 422s of the drill parameters. Unit A3, shift A of
 * 1 Mar 2027: two overlapping stops of two assets coded Bearing / Seal (children of Mechanical) and a
 * separate 30 min Electrical stop. Test data only.
 */
describe('Downtime report drill-down and summary (plan 3.3)', () => {
  const env = new AccountingWorld();
  const reasons = { mechanical: '', bearing: '', seal: '', electrical: '' };
  const assets = { pump: randomUUID(), valve: randomUUID() };
  const window = `from=${encodeURIComponent(DAY1)}&to=${encodeURIComponent(NEXT_DAY)}`;

  const report = async (query: string) =>
    (
      await env
        .get(`reports/downtime?${window}&unitIds=${env.world.unitA3}&${query}`)
        .expect(200)
    ).body as DowntimeBody;
  const refused = async (query: string) =>
    (
      await env
        .get(`reports/downtime?${window}&unitIds=${env.world.unitA3}&${query}`)
        .expect(422)
    ).body as ApiError;
  const reason = async (code: string, name: string, parentId?: string) =>
    (
      (await env.post('reason-codes', { code, name, parentId }).expect(201))
        .body as { id: string }
    ).id;

  beforeAll(async () => {
    await env.start();
    const unit = env.world.unitA3;
    for (const [id, name] of [
      [assets.pump, 'Pump'],
      [assets.valve, 'Valve'],
    ]) {
      await env.rows(
        `INSERT INTO assets (id, code, name, unit_id, tenant_id) VALUES ($1, $2, $2, $3, $4)`,
        [id, name, unit, env.world.tenantA],
      );
    }
    reasons.mechanical = await reason('MECH', 'Mechanical');
    reasons.bearing = await reason('BRG', 'Bearing', reasons.mechanical);
    reasons.seal = await reason('SEAL', 'Seal', reasons.mechanical);
    reasons.electrical = await reason('ELEC', 'Electrical');
    await env.materialize([unit], DAY1, NEXT_DAY);
    const stop = (start: string, hours: number, extra: object) =>
      env.lossEvent(unit, start, hours, {
        scheduleClass: 'unplanned',
        ...extra,
      });
    await stop(plus(A, HOUR), 1, {
      reasonCodeId: reasons.bearing,
      assetId: assets.pump,
    });
    await stop(plus(A, 1.5 * HOUR), 1, {
      reasonCodeId: reasons.seal,
      assetId: assets.valve,
    });
    await stop(plus(A, 4 * HOUR), 0.5, { reasonCodeId: reasons.electrical });
    await env.settle();
  });
  afterAll(() => env.stop());

  it('reason level 1 Pareto: shares and a cumulative share that reaches 1', async () => {
    const body = await report('groupBy=reasonLevel1');
    expect(body.data.total).toBe('7200');
    expect(body.data.groups).toEqual([
      expect.objectContaining({
        key: reasons.mechanical,
        label: 'MECH Mechanical',
        value: '5400',
        share: '0.75',
        cumulativeShare: '0.75',
      }),
      expect.objectContaining({
        key: reasons.electrical,
        value: '1800',
        share: '0.25',
        cumulativeShare: '1',
      }),
    ]);
    expect(body.data.calculationRunIds.length).toBeGreaterThan(0);
  });

  it('drills one level below a parent, by duration and by frequency', async () => {
    const duration = await report(
      `groupBy=reasonChild&parentReasonId=${reasons.mechanical}`,
    );
    expect(duration.data.parentReasonId).toBe(reasons.mechanical);
    expect(duration.data.total).toBe('5400');
    expect(duration.data.groups.map((g) => [g.key, g.value]).sort()).toEqual(
      [
        [reasons.bearing, '2700'],
        [reasons.seal, '2700'],
      ].sort(),
    );
    expect(duration.data.groups[1].cumulativeShare).toBe('1');
    const frequency = await report(
      `groupBy=reasonChild&parentReasonId=${reasons.mechanical}&metric=frequency`,
    );
    // the overlapping stops are on different assets: two occurrences, one per code
    expect(frequency.data.groups.map((g) => [g.key, g.value]).sort()).toEqual(
      [
        [reasons.bearing, '1'],
        [reasons.seal, '1'],
      ].sort(),
    );
  });

  it('a parent restricts the other reason groupings to its subtree', async () => {
    const leaves = await report(
      `groupBy=reason&parentReasonId=${reasons.mechanical}`,
    );
    expect(leaves.data.groups.map((g) => g.key).sort()).toEqual(
      [reasons.bearing, reasons.seal].sort(),
    );
    const leaf = await report(
      `groupBy=reasonChild&parentReasonId=${reasons.bearing}`,
    );
    // coded at the parent's own level: the parent's id
    expect(leaf.data.groups).toEqual([
      expect.objectContaining({ key: reasons.bearing, value: '2700' }),
    ]);
  });

  it('asset breakdown shares the overlap (allocated, adds up to the unit union)', async () => {
    const body = await report('groupBy=asset');
    const value = (key: string | null) =>
      body.data.groups.find((g) => g.key === key)?.value;
    expect(value(assets.pump)).toBe('2700');
    expect(value(assets.valve)).toBe('2700');
    expect(value(null)).toBe('1800');
    expect(body.data.total).toBe('7200');
  });

  it('summary: period KPIs of the scope, independent of the grouping', async () => {
    const body = await report('groupBy=asset&scheduleClass=planned');
    const metric = (name: string) =>
      body.data.summary.find((s) => s.metric === name);
    expect(body.data.total).toBe('0');
    expect(metric('downtime_total')?.value).toBe('7200');
    expect(metric('downtime_unplanned')?.value).toBe('7200');
    expect(metric('stop_count')?.value).toBe('3');
    expect(metric('carry_in_count')?.value).toBe('0');
    expect(metric('scheduled_availability')?.value).not.toBeNull();
    expect(body.data.summary.map((s) => s.metric)).toEqual([
      'downtime_total',
      'downtime_planned',
      'downtime_unplanned',
      'microstop_time',
      'unknown_time',
      'stop_count',
      'carry_in_count',
      'mean_stop_duration',
      'scheduled_availability',
      'onstream_factor',
    ]);
  });

  it('bundle (T24): each view equals the single report with the same filters, runs shared', async () => {
    const tokens = [
      'reasonLevel1',
      'asset:frequency',
      'day:duration:unplanned',
      'reasonLevel1',
    ];
    const views = tokens.map((t) => `views=${encodeURIComponent(t)}`).join('&');
    const bundle = (
      await env
        .get(
          `reports/downtime-bundle?${window}&unitIds=${env.world.unitA3}&${views}`,
        )
        .expect(200)
    ).body as BundleBody;
    expect(bundle.data.views.map((v) => v.view)).toEqual(tokens.slice(0, 3));
    const singles = [
      'groupBy=reasonLevel1',
      'groupBy=asset&metric=frequency',
      'groupBy=day&scheduleClass=unplanned',
    ];
    for (const [index, query] of singles.entries()) {
      const single = await report(query);
      expect(bundle.data.views[index].groups).toEqual(single.data.groups);
      expect(bundle.data.views[index].total).toBe(single.data.total);
      expect(bundle.data.calculationRunIds).toEqual(
        single.data.calculationRunIds,
      );
      expect(bundle.data.summary).toEqual(single.data.summary);
    }
    expect(bundle.data.views[2].scheduleClass).toBe('unplanned');
    await env
      .get(`reports/downtime-bundle?${window}&unitIds=${env.world.unitA3}`)
      .expect(422);
  });

  it('422: reasonChild without a parent, a parent with a non-reason grouping, a foreign parent', async () => {
    expect((await refused('groupBy=reasonChild')).code).toBe(
      'PARENT_REASON_REQUIRED',
    );
    expect(
      (await refused(`groupBy=asset&parentReasonId=${reasons.mechanical}`))
        .code,
    ).toBe('PARENT_REASON_NOT_APPLICABLE');
    expect(
      (await refused(`groupBy=reasonChild&parentReasonId=${randomUUID()}`))
        .code,
    ).toBe('INVALID_REFERENCE');
    const foreign = (
      (
        await env
          .post(
            'reason-codes',
            { code: 'B-ROOT', name: 'Tenant B root' },
            env.adminB,
          )
          .expect(201)
      ).body as { id: string }
    ).id;
    expect(
      (await refused(`groupBy=reasonChild&parentReasonId=${foreign}`)).code,
    ).toBe('INVALID_REFERENCE');
  });
});
