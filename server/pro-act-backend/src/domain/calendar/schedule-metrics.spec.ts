import { computeUnitDowntime } from '../events/unit-downtime';
import { CalendarDefinition, GeneratedShift } from './calendar.types';
import {
  assignCrews,
  CrewRotationInput,
  rotationShiftOn,
} from './crew-rotation';
import {
  instancesHash,
  productionDate,
  scheduleBreakdown,
  scheduledSeconds,
  shiftBoundaries,
} from './schedule-metrics';
import { downtimeBySchedule } from './shift-downtime';
import { generateShifts } from './shift-generator';

const DAY = { from: '2026-10-07', to: '2026-10-07' };

function dubai(
  overrides: Partial<CalendarDefinition> = {},
): CalendarDefinition {
  return {
    timezone: 'Asia/Dubai',
    operationalDayStart: '06:00',
    shiftTemplates: [
      { name: 'Morning', startLocal: '06:00', endLocal: '14:00' },
      { name: 'Afternoon', startLocal: '14:00', endLocal: '22:00' },
      { name: 'Night', startLocal: '22:00', endLocal: '06:00' },
    ],
    workingIntervals: [],
    holidays: [],
    exclusions: [],
    ...overrides,
  };
}

/** Whole operational day 2026-10-07 in Dubai (+04:00). */
const DAY_WINDOW = {
  start: new Date('2026-10-07T02:00:00Z'),
  end: new Date('2026-10-08T02:00:00Z'),
};

function rows(
  instances: GeneratedShift[],
): Array<[string, string, boolean, string | null]> {
  return instances.map((s) => [
    s.shiftName,
    `${s.localStart.slice(11, 16)}-${s.localEnd.slice(11, 16)}`,
    s.isExcluded,
    s.exclusionKind,
  ]);
}

describe('schedule exclusions, holidays and working intervals (CAL01)', () => {
  it('an exclusion inside a shift splits the instance; scheduledSeconds leaves it out', () => {
    const definition = dubai({
      exclusions: [
        {
          from: '2026-10-07T10:00:00+04:00',
          to: '2026-10-07T11:00:00+04:00',
          reason: 'extruder screw change',
          kind: 'planned_shutdown',
        },
      ],
    });
    const { instances } = generateShifts(definition, DAY);
    expect(rows(instances)).toEqual([
      ['Morning', '06:00-10:00', false, null],
      ['Morning', '10:00-11:00', true, 'planned_shutdown'],
      ['Morning', '11:00-14:00', false, null],
      ['Afternoon', '14:00-22:00', false, null],
      ['Night', '22:00-06:00', false, null],
    ]);
    expect(instances[1].exclusionReason).toBe('extruder screw change');
    expect(scheduledSeconds(instances, DAY_WINDOW)).toBe(86_400 - 3_600);
    expect(scheduleBreakdown(instances, DAY_WINDOW)).toMatchObject({
      scheduledSeconds: 82_800,
      scheduleExclusionSeconds: 3_600,
      exclusionSecondsByKind: { planned_shutdown: 3_600 },
      unscheduledSeconds: 0,
    });
  });

  it('an excluded holiday excludes every shift of its operational date; reduced only warns', () => {
    const excluded = generateShifts(
      dubai({
        holidays: [
          { date: '2026-10-07', name: 'National day', treatment: 'excluded' },
        ],
      }),
      DAY,
    );
    expect(
      excluded.instances.every(
        (s) => s.isExcluded && s.exclusionKind === 'holiday',
      ),
    ).toBe(true);
    expect(scheduleBreakdown(excluded.instances, DAY_WINDOW)).toMatchObject({
      scheduledSeconds: 0,
      exclusionSecondsByKind: { holiday: 86_400 },
    });
    const reduced = generateShifts(
      dubai({
        holidays: [
          { date: '2026-10-07', name: 'Half day', treatment: 'reduced' },
        ],
      }),
      DAY,
    );
    expect(scheduledSeconds(reduced.instances, DAY_WINDOW)).toBe(86_400);
    expect(reduced.warnings.map((w) => w.code)).toEqual(['holiday_reduced']);
  });

  it('with working intervals, shift time outside them is non_working', () => {
    const { instances } = generateShifts(
      dubai({ workingIntervals: [{ startLocal: '08:00', endLocal: '12:00' }] }),
      DAY,
    );
    expect(rows(instances)).toEqual([
      ['Morning', '06:00-08:00', true, 'non_working'],
      ['Morning', '08:00-12:00', false, null],
      ['Morning', '12:00-14:00', true, 'non_working'],
      ['Afternoon', '14:00-22:00', true, 'non_working'],
      ['Night', '22:00-06:00', true, 'non_working'],
    ]);
    expect(scheduledSeconds(instances, DAY_WINDOW)).toBe(4 * 3_600);
  });

  it('window time with no shift is unscheduled', () => {
    const { instances } = generateShifts(
      dubai({
        shiftTemplates: [
          { name: 'Day', startLocal: '08:00', endLocal: '16:00' },
        ],
      }),
      DAY,
    );
    expect(scheduleBreakdown(instances, DAY_WINDOW)).toMatchObject({
      scheduledSeconds: 28_800,
      unscheduledSeconds: 57_600,
    });
  });
});

describe('boundaries, production date and hash', () => {
  it('boundaries are the sorted shift changes strictly inside the window', () => {
    const { instances } = generateShifts(dubai(), DAY);
    expect(
      shiftBoundaries(instances, DAY_WINDOW).map((d) => d.toISOString()),
    ).toEqual(['2026-10-07T10:00:00.000Z', '2026-10-07T18:00:00.000Z']);
  });

  it('production date follows the operational-day rule (midnight-crossing shift → date of its start)', () => {
    expect(productionDate(new Date('2026-10-07T18:30:00Z'), 210, '06:00')).toBe(
      '2026-10-07',
    );
    expect(productionDate(new Date('2026-10-08T01:00:00Z'), 210, '06:00')).toBe(
      '2026-10-07',
    );
    expect(productionDate(new Date('2026-10-08T02:30:00Z'), 210, '06:00')).toBe(
      '2026-10-08',
    );
  });

  it('the hash is stable for equal rows and changes with any field', () => {
    const { instances } = generateShifts(dubai(), {
      from: '2026-10-01',
      to: '2026-10-31',
    });
    const rowsOf = (list: GeneratedShift[]) =>
      list.map((s) => ({ ...s, calendarVersionId: 'v1' }));
    const again = generateShifts(dubai(), {
      from: '2026-10-01',
      to: '2026-10-31',
    }).instances;
    expect(instancesHash(rowsOf(instances))).toBe(
      instancesHash(rowsOf([...again].reverse())),
    );
    const changed = rowsOf(instances).map((s, i) =>
      i === 0 ? { ...s, crewId: 'crew' } : s,
    );
    expect(instancesHash(changed)).not.toBe(instancesHash(rowsOf(instances)));
  });
});

describe('crew rotations (CAL02: assignment only)', () => {
  const rotation = (
    crewId: string,
    cycle: Array<string | null>,
  ): CrewRotationInput => ({
    crewId,
    pattern: { anchorDate: '2026-10-05', cycle },
    effectiveFrom: '2026-10-05',
    effectiveTo: null,
  });

  it('a cycle puts the crew on the shift of (date − anchor) mod length', () => {
    const r = rotation('red', ['Morning', 'Morning', 'Night', null]);
    expect(
      [
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-08',
        '2026-10-09',
      ].map((d) => rotationShiftOn(r, d)),
    ).toEqual(['Morning', 'Morning', 'Night', null, 'Morning']);
    expect(rotationShiftOn(r, '2026-10-04')).toBeNull();
  });

  it('T19: changing crews never changes bounds or scheduled seconds', () => {
    const { instances } = generateShifts(dubai(), {
      from: '2026-10-05',
      to: '2026-10-11',
    });
    const before = assignCrews(instances, [
      rotation('red', ['Morning', 'Afternoon', 'Night']),
    ]);
    const after = assignCrews(instances, [rotation('blue', ['Night', null])]);
    const window = {
      start: instances[0].utcStart,
      end: instances[instances.length - 1].utcEnd,
    };
    expect(before.map((s) => [s.utcStart, s.utcEnd])).toEqual(
      after.map((s) => [s.utcStart, s.utcEnd]),
    );
    expect(scheduledSeconds(before, window)).toBe(
      scheduledSeconds(after, window),
    );
    expect(before[0].crewId).toBe('red');
    expect(after[0].crewId).toBeNull();
  });

  it('two crews on one shift leave it unassigned with a warning', () => {
    const { instances } = generateShifts(dubai(), DAY);
    const warnings: Parameters<typeof assignCrews>[2] = [];
    const assigned = assignCrews(
      instances,
      [rotation('red', ['Night']), rotation('blue', ['Night'])],
      warnings,
    );
    expect(assigned.find((s) => s.shiftName === 'Night')?.crewId).toBeNull();
    expect(warnings).toEqual([
      expect.objectContaining({ code: 'crew_conflict', shiftName: 'Night' }),
    ]);
  });
});

describe('downtime by shift — T29 cross-shift clipping', () => {
  const shifts = generateShifts(dubai(), {
    from: '2026-10-06',
    to: '2026-10-07',
  }).instances.map((s, i) => ({
    ...s,
    id: `shift-${i}`,
  }));

  it('a stop 05:50–06:20 local gives 600 s to the night shift and 1200 s to the morning shift, one occurrence', () => {
    const window = {
      start: new Date('2026-10-06T18:00:00Z'),
      end: new Date('2026-10-07T10:00:00Z'),
    };
    const downtime = computeUnitDowntime(
      [
        {
          id: 'e1',
          assetId: null,
          start: new Date('2026-10-07T01:50:00Z'),
          end: new Date('2026-10-07T02:20:00Z'),
        },
      ],
      window,
      new Date('2026-10-08T00:00:00Z'),
    );
    const inWindow = shifts.filter(
      (s) => s.utcStart < window.end && s.utcEnd > window.start,
    );
    const result = downtimeBySchedule(downtime.occurrences, inWindow, window);
    const bySeconds = result.shifts
      .filter((s) => s.downtimeSeconds > 0)
      .map((s) => [
        s.shiftName,
        s.localDate,
        s.downtimeSeconds,
        s.occurrenceCount,
      ]);
    expect(bySeconds).toEqual([
      ['Night', '2026-10-06', 600, 1],
      ['Morning', '2026-10-07', 1200, 1],
    ]);
    expect(result.occurrenceCount).toBe(1);
    expect(result.scheduledDowntimeSeconds).toBe(1800);
    expect(result.outsideScheduleSeconds).toBe(0);
  });

  it('downtime inside excluded time is outside the schedule', () => {
    const excluded = shifts.map((s) => ({
      ...s,
      isExcluded: s.shiftName === 'Night',
    }));
    const window = {
      start: new Date('2026-10-06T18:00:00Z'),
      end: new Date('2026-10-07T10:00:00Z'),
    };
    const downtime = computeUnitDowntime(
      [
        {
          id: 'e1',
          assetId: null,
          start: new Date('2026-10-07T01:50:00Z'),
          end: new Date('2026-10-07T02:20:00Z'),
        },
      ],
      window,
      new Date('2026-10-08T00:00:00Z'),
    );
    const result = downtimeBySchedule(downtime.occurrences, excluded, window);
    expect([
      result.scheduledDowntimeSeconds,
      result.outsideScheduleSeconds,
    ]).toEqual([1200, 600]);
  });
});
