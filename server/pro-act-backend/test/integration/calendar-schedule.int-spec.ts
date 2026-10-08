import { CalendarMaterializationJob } from '../../src/calendar/calendar-materialization.job';
import { CalendarMaterializerService } from '../../src/calendar/calendar-materializer.service';
import { CalendarService } from '../../src/calendar/calendar.service';
import { SitesService } from '../../src/calendar/sites.service';
import { insertTenantAEvent } from './support/seed-event-world';
import { UnitDowntimeService } from '../../src/production-event/unit-downtime.service';
import {
  ApiError,
  CalendarWorld,
  threeShiftCalendar,
} from './support/calendar-world';

interface PreviewBody {
  scheduledSeconds: number;
  instances: Array<{
    shiftName: string;
    utcOffsetStart: number;
    utcOffsetEnd: number;
    localStart: string;
  }>;
  warnings: Array<{ code: string; shiftName: string | null }>;
  diff: {
    added: unknown[];
    removed: unknown[];
    changed: unknown[];
    unchangedCount: number;
  };
}

const window = (start: string, end: string) => ({
  start: new Date(start),
  end: new Date(end),
});

/**
 * Plan 2.1 schedule semantics on stored instances: T19 (DST days of 25 h / 23 h with both offsets
 * stored), exclusions in the capacity breakdown, T29 cross-shift clipping through UnitDowntimeService,
 * the v1 shift-label bridge, the preview (warnings and diff) and the materialization job (gap-fill,
 * idempotent).
 */
describe('calendar schedule: DST, exclusions, downtime by shift, preview (plan 2.1)', () => {
  const env = new CalendarWorld();
  const materialize = async (unitId: string, from: string, to: string) => {
    const site = await env.app.get(SitesService).defaultSite(env.world.tenantA);
    return env.app.get(CalendarMaterializerService).materialize({
      site,
      unitIds: [unitId],
      from,
      to,
      replaceFrom: null,
      actorId: null,
    });
  };

  beforeAll(async () => {
    await env.start();
    await env.publish({
      unitId: env.world.unitA1,
      ...threeShiftCalendar('Europe/Berlin'),
      effectiveFrom: '2026-10-01',
    });
    await materialize(env.world.unitA1, '2026-10-20', '2026-10-31');
    await materialize(env.world.unitA1, '2027-03-26', '2027-03-28');
    await env.publish({
      unitId: env.world.unitA3,
      timezone: 'Asia/Dubai',
      operationalDayStart: '06:00',
      shiftTemplates: [
        { name: 'Morning', startLocal: '06:00', endLocal: '14:00' },
        { name: 'Afternoon', startLocal: '14:00', endLocal: '22:00' },
        { name: 'Night', startLocal: '22:00', endLocal: '06:00' },
      ],
      exclusions: [
        {
          from: '2026-10-07T10:00:00+04:00',
          to: '2026-10-07T11:00:00+04:00',
          reason: 'screw change',
          kind: 'planned_shutdown',
        },
      ],
      effectiveFrom: '2026-10-01',
    });
    await materialize(env.world.unitA3, '2026-10-05', '2026-10-08');
  });
  afterAll(() => env.stop());

  it('T19: the Berlin fall-back day is 25 h with both offsets stored; spring-forward is 23 h', async () => {
    const calendar = env.app.get(CalendarService);
    const fallBack = await calendar.scheduleBreakdown(
      env.world.tenantA,
      env.world.unitA1,
      window('2026-10-24T04:00:00Z', '2026-10-25T05:00:00Z'),
    );
    expect(fallBack.scheduledSeconds).toBe(90_000);
    expect(fallBack.unscheduledSeconds).toBe(0);
    const [night] = await env.rows<{
      utc_offset_start: number;
      utc_offset_end: number;
      local_start: string;
      local_end: string;
    }>(
      `SELECT utc_offset_start, utc_offset_end, local_start, local_end FROM shift_instances
        WHERE unit_id = $1 AND local_date = '2026-10-24' AND shift_name = 'C'`,
      [env.world.unitA1],
    );
    expect(night).toEqual({
      utc_offset_start: 120,
      utc_offset_end: 60,
      local_start: '2026-10-24T22:00:00+02:00',
      local_end: '2026-10-25T06:00:00+01:00',
    });
    expect(
      await calendar.scheduledSeconds(
        env.world.tenantA,
        env.world.unitA1,
        window('2027-03-27T05:00:00Z', '2027-03-28T04:00:00Z'),
      ),
    ).toBe(82_800);
    expect(
      await calendar.scheduledSeconds(
        env.world.tenantB,
        env.world.unitA1,
        window('2026-10-24T04:00:00Z', '2026-10-25T05:00:00Z'),
      ),
    ).toBe(0);
  });

  it('an exclusion splits the stored instance; the breakdown reports the schedule_exclusion bucket', async () => {
    const calendar = env.app.get(CalendarService);
    const day = window('2026-10-07T02:00:00Z', '2026-10-08T02:00:00Z');
    const breakdown = await calendar.scheduleBreakdown(
      env.world.tenantA,
      env.world.unitA3,
      day,
    );
    expect(breakdown).toMatchObject({
      scheduledSeconds: 82_800,
      scheduleExclusionSeconds: 3_600,
      exclusionSecondsByKind: { planned_shutdown: 3_600 },
    });
    const boundaries = await calendar.boundaries(
      env.world.tenantA,
      env.world.unitA3,
      day,
    );
    expect(boundaries.map((d) => d.toISOString())).toEqual([
      '2026-10-07T06:00:00.000Z',
      '2026-10-07T07:00:00.000Z',
      '2026-10-07T10:00:00.000Z',
      '2026-10-07T18:00:00.000Z',
    ]);
  });

  it('T29: a stop 05:50–06:20 local is 600 s in the night shift and 1200 s in the morning shift, one occurrence', async () => {
    const id = await insertTenantAEvent(
      env.harness.dataSource,
      env.world,
      new Date('2026-10-07T01:50:00Z'),
      new Date('2026-10-07T02:20:00Z'),
    );
    await env.rows(
      `UPDATE production_events SET physical_type = 'downtime', physical_state = 'closed' WHERE id = $1`,
      [id],
    );
    const result = await env.app
      .get(UnitDowntimeService)
      .byShift(
        env.world.tenantA,
        env.world.unitA3,
        window('2026-10-07T01:00:00Z', '2026-10-07T03:00:00Z'),
      );
    expect(
      result.schedule.shifts.map((s) => [
        s.shiftName,
        s.localDate,
        s.downtimeSeconds,
        s.occurrenceCount,
      ]),
    ).toEqual([
      ['Night', '2026-10-06', 600, 1],
      ['Morning', '2026-10-07', 1200, 1],
    ]);
    expect(result.schedule.occurrenceCount).toBe(1);
    expect(result.downtimeSeconds).toBe(1800);
  });

  it('v1 reads label shift from the instance containing the start; uncovered events keep their text', async () => {
    const { e3, e5 } = env.world.events;
    await env.rows(
      `UPDATE production_events SET shift = 'free text' WHERE id = $1`,
      [e5],
    );
    await env.rows(`UPDATE production_events SET shift = 'Day' WHERE id = $1`, [
      e3,
    ]);
    const read = async (id: string) =>
      (
        await env
          .http()
          .get(`/api/production-events/${id}`)
          .set('Authorization', `Bearer ${env.admin}`)
          .expect(200)
      ).body as {
        shift: string;
      };
    expect((await read(e5)).shift).toBe('Morning');
    expect((await read(e3)).shift).toBe('Day');
    const list = await env
      .http()
      .get('/api/production-events')
      .query({ unitId: env.world.unitA3 })
      .set('Authorization', `Bearer ${env.admin}`)
      .expect(200);
    expect(
      (list.body as Array<{ id: string; shift: string }>).find(
        (e) => e.id === e5,
      )?.shift,
    ).toBe('Morning');
  });

  it('preview: DST warnings and offsets of a candidate, diff against the stored instances', async () => {
    const preview = async (body: object) =>
      (await env.post('calendars/preview', body).expect(200))
        .body as PreviewBody;
    const berlin = await preview({
      unitId: env.world.unitA2,
      localFrom: '2026-10-24',
      localTo: '2026-10-24',
      candidateVersion: threeShiftCalendar('Europe/Berlin'),
    });
    expect(berlin.scheduledSeconds).toBe(90_000);
    expect(berlin.warnings).toEqual([
      expect.objectContaining({ code: 'timezone_fallback' }),
      expect.objectContaining({ code: 'dst_repeat', shiftName: 'C' }),
    ]);
    const twelves = await preview({
      unitId: env.world.unitA1,
      localFrom: '2026-10-21',
      localTo: '2026-10-22',
      candidateVersion: {
        timezone: 'Europe/Berlin',
        shiftTemplates: [
          { name: 'Day', startLocal: '06:00', endLocal: '18:00' },
          { name: 'Night', startLocal: '18:00', endLocal: '06:00' },
        ],
      },
    });
    expect([
      twelves.diff.added.length,
      twelves.diff.changed.length,
      twelves.diff.removed.length,
      twelves.diff.unchangedCount,
    ]).toEqual([2, 2, 4, 0]);
  });

  it('preview refuses foreign units, foreign candidates, both/neither candidates and long ranges (422)', async () => {
    const [foreignVersion] = await env.rows<{ id: string }>(
      `SELECT id FROM calendar_versions LIMIT 1`,
    );
    const codeOf = async (body: object, token = env.admin) =>
      (
        (await env.post('calendars/preview', body, token).expect(422))
          .body as ApiError
      ).code;
    const base = {
      unitId: env.world.unitA1,
      localFrom: '2026-10-21',
      localTo: '2026-10-22',
    };
    expect(
      await codeOf({
        ...base,
        unitId: env.world.unitB1,
        candidateVersion: threeShiftCalendar('UTC'),
      }),
    ).toBe('INVALID_REFERENCE');
    expect(
      await codeOf(
        {
          ...base,
          unitId: env.world.unitB1,
          candidateVersionId: foreignVersion.id,
        },
        env.adminB,
      ),
    ).toBe('INVALID_REFERENCE');
    expect(
      await codeOf(
        { ...base, candidateVersionId: foreignVersion.id },
        env.adminB,
      ),
    ).toBe('INVALID_REFERENCE');
    expect(await codeOf(base)).toBe('CANDIDATE_REQUIRED');
    expect(
      await codeOf({
        ...base,
        localTo: '2027-01-01',
        candidateVersion: threeShiftCalendar('UTC'),
      }),
    ).toBe('INVALID_RANGE');
  });

  it('the materialization job fills missing future instances once and is idempotent', async () => {
    const today = await env.todayA();
    await env.rows(
      `DELETE FROM shift_instances WHERE unit_id = $1 AND local_date >= $2`,
      [env.world.unitA1, today],
    );
    const job = env.app.get(CalendarMaterializationJob);
    const written = await job.topUp();
    expect(written).toBeGreaterThanOrEqual(91 * 3);
    expect(await job.topUp()).toBe(0);
  });
});
