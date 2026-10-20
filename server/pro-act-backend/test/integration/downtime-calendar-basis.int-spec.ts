import { CalendarMaterializerService } from '../../src/calendar/calendar-materializer.service';
import { SitesService } from '../../src/calendar/sites.service';
import { HOUR } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';

interface KpiView {
  metric: string;
  basis?: string;
  numerator: string | null;
  denominator: string | null;
  value: string | null;
  reason: string | null;
}

interface CalendarBasis {
  basis: string;
  label: string;
  omitted: string | null;
  timezone: string;
  units: Array<{
    unitId: string;
    days: Array<{ localDate: string; from: string; to: string }>;
    kpis: KpiView[];
  }>;
  total: KpiView[];
}

interface Body {
  data: { summary: KpiView[]; calendarBasis: CalendarBasis };
}

/** 1 Sep 2026, 06:00 Asia/Tehran (UTC+3:30, no DST): one past production day. */
const DAY = '2026-09-01T02:30:00.000Z';
const NEXT = '2026-09-02T02:30:00.000Z';
const DAY_S = 86_400;

/**
 * Plan 2.3 on real Postgres: unit A2 has no production period on 1 Sep 2026 (no calendar instance
 * materialized, so no plan and no run), unit A3 has calculated periods that day. A2's stops are reported on
 * calendar basis — calendar availability, downtime, stop count and MTBF over 24 h of calendar time — apart
 * from A3's run-based summary, never summed into it. Test data only.
 */
describe('Downtime KPIs on a calendar basis (plan 2.3)', () => {
  const env = new AccountingWorld();
  const query = (units: string[], extra = '') =>
    `from=${encodeURIComponent(DAY)}&to=${encodeURIComponent(NEXT)}` +
    units.map((u) => `&unitIds=${u}`).join('') +
    extra;
  const bundle = async (units: string[], extra = '', token = env.admin) =>
    (
      await env
        .get(`reports/downtime-bundle?${query(units, extra)}&views=day`, token)
        .expect(200)
    ).body as Body;
  const metric = (list: KpiView[], name: string) =>
    list.find((k) => k.metric === name);

  beforeAll(async () => {
    await env.start();
    const { unitA2, unitA3 } = env.world;
    const sites = env.app.get(SitesService);
    const created = await sites.defaultSite(env.world.tenantA);
    // the plant's day: Asia/Tehran, starting 06:00 (the world's tenant has no timezone, so the default site is UTC)
    await env.rows(
      `UPDATE sites SET timezone = 'Asia/Tehran', operational_day_start = '06:00' WHERE id = $1`,
      [created.id],
    );
    const site = await sites.defaultSite(env.world.tenantA);
    await env.app.get(CalendarMaterializerService).materialize({
      site,
      unitIds: [unitA3],
      from: '2026-09-01',
      to: '2026-09-03',
      replaceFrom: null,
      actorId: null,
    });
    await env.materialize([unitA3], DAY, NEXT);
    await env.lossEvent(unitA3, plus(DAY, HOUR), 1, {
      scheduleClass: 'unplanned',
    });
    await env.lossEvent(unitA2, plus(DAY, HOUR), 2, {
      scheduleClass: 'unplanned',
      failureMode: 'Bearing',
    });
    await env.lossEvent(unitA2, plus(DAY, 10 * HOUR), 1, {
      scheduleClass: 'planned',
    });
    await env.settle();
  });
  afterAll(() => env.stop());

  it('a unit without periods gets calendar-basis KPIs over 24 h of calendar time', async () => {
    const body = await bundle([env.world.unitA2]);
    const calendar = body.data.calendarBasis;
    expect(calendar).toMatchObject({
      basis: 'calendar',
      omitted: null,
      timezone: 'Asia/Tehran',
    });
    expect(calendar.label).toBe(
      'Calendar basis — no plan or calendar for these units/days',
    );
    expect(calendar.units).toHaveLength(1);
    const [unit] = calendar.units;
    expect(unit.days).toEqual([
      { localDate: '2026-09-01', from: DAY, to: NEXT },
    ]);
    expect(metric(unit.kpis, 'downtime_total')?.value).toBe('10800');
    expect(metric(unit.kpis, 'downtime_unplanned')?.value).toBe('7200');
    expect(metric(unit.kpis, 'stop_count')?.value).toBe('2');
    const availability = metric(unit.kpis, 'calendar_availability');
    expect(availability?.denominator).toBe(String(DAY_S));
    // (86400 − 7200) ÷ 86400, as the server's 8-place decimal string
    expect(availability?.value).toBe('0.91666667');
    const mtbf = metric(unit.kpis, 'mtbf');
    expect(mtbf).toMatchObject({
      value: String(DAY_S - 10800),
      denominator: '1',
    });
    expect(metric(calendar.total, 'downtime_total')?.value).toBe('10800');
  });

  it('keeps calendar-basis figures out of the run-based summary of a calculated unit', async () => {
    const body = await bundle([env.world.unitA2, env.world.unitA3]);
    const units = body.data.calendarBasis.units.map((u) => u.unitId);
    expect(units).toEqual([env.world.unitA2]);
    const total = metric(body.data.summary, 'downtime_total');
    expect(total).toMatchObject({ basis: 'calculated', value: '3600' });
    expect(metric(body.data.calendarBasis.total, 'downtime_total')?.value).toBe(
      '10800',
    );
  });

  it('a calculated unit alone has no calendar-basis unit', async () => {
    const body = await bundle([env.world.unitA3]);
    expect(body.data.calendarBasis.units).toEqual([]);
    expect(
      metric(body.data.calendarBasis.total, 'calendar_availability'),
    ).toMatchObject({
      value: null,
      reason: 'no_calendar_time',
    });
  });

  it('filters only calculated periods carry leave the calendar basis out, with the reason', async () => {
    const approved = await bundle([env.world.unitA2], '&approvedOnly=true');
    expect(approved.data.calendarBasis).toMatchObject({
      omitted: 'approved_only',
      units: [],
    });
    const unplanned = await bundle(
      [env.world.unitA2],
      '&scheduleClass=unplanned',
    );
    expect(unplanned.data.calendarBasis.omitted).toBe('schedule_class');
  });

  it('follows the caller scope: a unit-limited user never sees another unit, another tenant gets 422', async () => {
    const a3Only = await env.unitUser(env.world.unitA3);
    const own = await bundle([], '', a3Only);
    expect(own.data.calendarBasis.units).toEqual([]);
    await env
      .get(
        `reports/downtime-bundle?${query([env.world.unitA2])}&views=day`,
        env.adminB,
      )
      .expect(422);
  });

  it('the single downtime report carries the same calendar basis', async () => {
    const response = await env
      .get(`reports/downtime?${query([env.world.unitA2])}`)
      .expect(200);
    const body = response.body as Body;
    expect(metric(body.data.calendarBasis.total, 'stop_count')?.value).toBe(
      '2',
    );
    expect(body.data.summary.every((k) => k.basis === 'calculated')).toBe(true);
  });
});
