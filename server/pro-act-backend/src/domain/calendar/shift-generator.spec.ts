import {
  CalendarDefinition,
  CalendarDefinitionError,
  GeneratedShift,
} from './calendar.types';
import { scheduledSeconds } from './schedule-metrics';
import { generateShifts } from './shift-generator';
import { addDays, wallOfDate } from './wall-clock';
import { ZoneTimeline } from './zone-timeline';

/** D03 shape: operational day 06:00, 3 × 8 h shifts. */
function threeShifts(timezone: string, dayStart = '06:00'): CalendarDefinition {
  return {
    timezone,
    operationalDayStart: dayStart,
    shiftTemplates: [
      { name: 'A', startLocal: '06:00', endLocal: '14:00' },
      { name: 'B', startLocal: '14:00', endLocal: '22:00' },
      { name: 'C', startLocal: '22:00', endLocal: '06:00' },
    ],
    workingIntervals: [],
    holidays: [],
    exclusions: [],
  };
}

function seconds(shift: GeneratedShift): number {
  return (shift.utcEnd.getTime() - shift.utcStart.getTime()) / 1000;
}

/** Total elapsed seconds of one operational date. */
function daySeconds(definition: CalendarDefinition, date: string): number {
  const { instances } = generateShifts(definition, { from: date, to: date });
  return instances.reduce((sum, s) => sum + seconds(s), 0);
}

function iso(date: Date): string {
  return date.toISOString().replace('.000', '');
}

describe('generateShifts — T19 DST calendar (CAL02)', () => {
  const berlin = threeShifts('Europe/Berlin');

  it('fall-back day is 25 h: the night shift carries both offsets', () => {
    const { instances, warnings } = generateShifts(berlin, {
      from: '2026-10-24',
      to: '2026-10-24',
    });
    expect(
      instances.map((s) => [s.shiftName, iso(s.utcStart), iso(s.utcEnd)]),
    ).toEqual([
      ['A', '2026-10-24T04:00:00Z', '2026-10-24T12:00:00Z'],
      ['B', '2026-10-24T12:00:00Z', '2026-10-24T20:00:00Z'],
      ['C', '2026-10-24T20:00:00Z', '2026-10-25T05:00:00Z'],
    ]);
    const night = instances[2];
    expect([night.utcOffsetStart, night.utcOffsetEnd]).toEqual([120, 60]);
    expect([night.localStart, night.localEnd]).toEqual([
      '2026-10-24T22:00:00+02:00',
      '2026-10-25T06:00:00+01:00',
    ]);
    expect(
      scheduledSeconds(instances, {
        start: instances[0].utcStart,
        end: night.utcEnd,
      }),
    ).toBe(90_000);
    expect(warnings).toEqual([
      expect.objectContaining({
        code: 'dst_repeat',
        shiftName: 'C',
        nominalSeconds: 28_800,
        actualSeconds: 32_400,
      }),
    ]);
  });

  it('spring-forward day is 23 h: the missing hour contributes no time', () => {
    expect(daySeconds(berlin, '2026-03-28')).toBe(82_800);
    const { instances, warnings } = generateShifts(berlin, {
      from: '2026-03-28',
      to: '2026-03-28',
    });
    expect(seconds(instances[2])).toBe(7 * 3600);
    expect(warnings.map((w) => w.code)).toEqual(['dst_gap']);
  });

  it('ordinary days are 24 h and nothing is forced to 24 h on transition days', () => {
    expect(daySeconds(berlin, '2026-10-23')).toBe(86_400);
    expect(daySeconds(berlin, '2026-10-25')).toBe(86_400);
  });

  it('a boundary inside the repeated hour yields two instances with distinct start offsets', () => {
    const definition: CalendarDefinition = {
      ...berlin,
      operationalDayStart: '02:30',
      shiftTemplates: [
        { name: 'A', startLocal: '02:30', endLocal: '10:30' },
        { name: 'B', startLocal: '10:30', endLocal: '18:30' },
        { name: 'C', startLocal: '18:30', endLocal: '02:30' },
      ],
    };
    const { instances, warnings } = generateShifts(definition, {
      from: '2026-10-24',
      to: '2026-10-26',
    });
    const a = instances.filter(
      (s) => s.localDate === '2026-10-25' && s.shiftName === 'A',
    );
    expect(
      a.map((s) => [
        iso(s.utcStart),
        iso(s.utcEnd),
        s.utcOffsetStart,
        s.localStart,
        s.localEnd,
      ]),
    ).toEqual([
      [
        '2026-10-25T00:30:00Z',
        '2026-10-25T01:00:00Z',
        120,
        '2026-10-25T02:30:00+02:00',
        '2026-10-25T03:00:00+02:00',
      ],
      [
        '2026-10-25T01:30:00Z',
        '2026-10-25T09:30:00Z',
        60,
        '2026-10-25T02:30:00+01:00',
        '2026-10-25T10:30:00+01:00',
      ],
    ]);
    const c = instances.filter(
      (s) => s.localDate === '2026-10-24' && s.shiftName === 'C',
    );
    expect(c.map((s) => [iso(s.utcStart), iso(s.utcEnd)])).toEqual([
      ['2026-10-24T16:30:00Z', '2026-10-25T00:30:00Z'],
      ['2026-10-25T01:00:00Z', '2026-10-25T01:30:00Z'],
    ]);
    assertContiguous(instances);
    expect(warnings.filter((w) => w.code === 'dst_split')).toHaveLength(2);
  });

  it('America/New_York: 23 h on 8 March, 25 h on 1 November (operational date 31 October)', () => {
    const newYork = threeShifts('America/New_York');
    expect(daySeconds(newYork, '2026-03-07')).toBe(82_800);
    expect(daySeconds(newYork, '2026-10-31')).toBe(90_000);
    expect(daySeconds(newYork, '2026-11-01')).toBe(86_400);
  });

  it('America/New_York: a shift starting inside the gap starts when the gap ends', () => {
    const definition: CalendarDefinition = {
      ...threeShifts('America/New_York', '02:30'),
      shiftTemplates: [{ name: 'D', startLocal: '02:30', endLocal: '10:30' }],
    };
    const { instances, warnings } = generateShifts(definition, {
      from: '2026-03-08',
      to: '2026-03-08',
    });
    expect(iso(instances[0].utcStart)).toBe('2026-03-08T07:00:00Z');
    expect(instances[0].localStart).toBe('2026-03-08T03:00:00-04:00');
    expect(seconds(instances[0])).toBe(7.5 * 3600);
    expect(warnings[0]).toMatchObject({
      code: 'dst_gap',
      actualSeconds: 27_000,
    });
  });

  it('Asia/Dubai has no DST: every day of the year is 24 h', () => {
    const dubai = threeShifts('Asia/Dubai');
    const { instances, warnings } = generateShifts(dubai, {
      from: '2026-01-01',
      to: '2026-12-31',
    });
    expect(instances).toHaveLength(365 * 3);
    expect(instances.every((s) => seconds(s) === 8 * 3600)).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('Australia/Lord_Howe shifts by 30 minutes: 24.5 h and 23.5 h days', () => {
    const lordHowe = threeShifts('Australia/Lord_Howe');
    expect(daySeconds(lordHowe, '2026-04-04')).toBe(88_200);
    expect(daySeconds(lordHowe, '2026-10-03')).toBe(84_600);
    const { instances } = generateShifts(lordHowe, {
      from: '2026-04-04',
      to: '2026-04-04',
    });
    expect([instances[2].utcOffsetStart, instances[2].utcOffsetEnd]).toEqual([
      660, 630,
    ]);
  });

  it('Asia/Tehran (D03): 3 × 8 h, the 22:00–06:00 shift keeps the production date of its start', () => {
    const { instances } = generateShifts(threeShifts('Asia/Tehran'), {
      from: '2026-10-07',
      to: '2026-10-07',
    });
    expect(
      instances.map((s) => [
        s.localDate,
        s.shiftName,
        iso(s.utcStart),
        iso(s.utcEnd),
      ]),
    ).toEqual([
      ['2026-10-07', 'A', '2026-10-07T02:30:00Z', '2026-10-07T10:30:00Z'],
      ['2026-10-07', 'B', '2026-10-07T10:30:00Z', '2026-10-07T18:30:00Z'],
      ['2026-10-07', 'C', '2026-10-07T18:30:00Z', '2026-10-08T02:30:00Z'],
    ]);
    expect(instances[2].localEnd).toBe('2026-10-08T06:00:00+03:30');
  });

  it('a shift starting after midnight but before the day start belongs to the previous operational date', () => {
    const definition: CalendarDefinition = {
      ...threeShifts('Asia/Dubai'),
      shiftTemplates: [
        { name: 'Day', startLocal: '06:00', endLocal: '00:00' },
        { name: 'Late', startLocal: '00:00', endLocal: '06:00' },
      ],
    };
    const { instances } = generateShifts(definition, {
      from: '2026-10-07',
      to: '2026-10-07',
    });
    expect(
      instances.map((s) => [s.shiftName, s.localDate, s.localStart]),
    ).toEqual([
      ['Day', '2026-10-07', '2026-10-07T06:00:00+04:00'],
      ['Late', '2026-10-07', '2026-10-08T00:00:00+04:00'],
    ]);
  });

  it('daysOfWeek limit a template to weekdays of the operational date', () => {
    const definition: CalendarDefinition = {
      ...threeShifts('Asia/Dubai'),
      shiftTemplates: [
        {
          name: 'Weekday',
          startLocal: '08:00',
          endLocal: '16:00',
          daysOfWeek: [1, 2, 3, 4, 5],
        },
      ],
    };
    const { instances } = generateShifts(definition, {
      from: '2026-10-05',
      to: '2026-10-11',
    });
    expect(instances.map((s) => s.localDate)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
  });

  it('regeneration is deterministic', () => {
    const range = { from: '2026-10-20', to: '2026-10-30' };
    expect(generateShifts(berlin, range)).toEqual(
      generateShifts(berlin, range),
    );
  });

  it('refuses overlapping templates, unknown zones and duplicate names (422 codes)', () => {
    const overlapping: CalendarDefinition = {
      ...berlin,
      shiftTemplates: [
        { name: 'A', startLocal: '06:00', endLocal: '14:00' },
        { name: 'B', startLocal: '13:00', endLocal: '21:00' },
      ],
    };
    const range = { from: '2026-10-07', to: '2026-10-07' };
    expect(errorCode(() => generateShifts(overlapping, range))).toBe(
      'OVERLAPPING_SHIFTS',
    );
    expect(
      errorCode(() =>
        generateShifts({ ...berlin, timezone: 'Mars/Olympus' }, range),
      ),
    ).toBe('INVALID_TIMEZONE');
    const duplicate = {
      ...berlin,
      shiftTemplates: [berlin.shiftTemplates[0], berlin.shiftTemplates[0]],
    };
    expect(errorCode(() => generateShifts(duplicate, range))).toBe(
      'DUPLICATE_SHIFT_NAME',
    );
  });
});

describe('ZoneTimeline', () => {
  it('maps a wall time inside the fall-back hour to its first occurrence', () => {
    const wall = wallOfDate('2026-10-25') + 2.5 * 3_600_000;
    const timeline = ZoneTimeline.forWallRange('Europe/Berlin', wall, wall);
    expect(new Date(timeline.instantOf(wall)).toISOString()).toBe(
      '2026-10-25T00:30:00.000Z',
    );
    expect(timeline.preimage(wall, wall + 1_800_000)).toHaveLength(2);
  });

  it('a wall interval wholly inside the spring-forward gap has no preimage', () => {
    const wall = wallOfDate('2026-03-29') + 2 * 3_600_000;
    const timeline = ZoneTimeline.forWallRange('Europe/Berlin', wall, wall);
    expect(timeline.preimage(wall, wall + 3_600_000)).toEqual([]);
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
  });
});

function errorCode(work: () => unknown): string | null {
  try {
    work();
    return null;
  } catch (error: unknown) {
    return error instanceof CalendarDefinitionError ? error.code : null;
  }
}

function assertContiguous(instances: GeneratedShift[]): void {
  for (let i = 1; i < instances.length; i++) {
    expect(instances[i].utcStart.getTime()).toBe(
      instances[i - 1].utcEnd.getTime(),
    );
  }
}

describe('explicit reduced-hours holidays', () => {
  it.each([
    ['Asia/Dubai', '2026-10-17', '06:00', '10:00', 4],
    ['Asia/Dubai', '2026-10-17', '22:00', '02:00', 4],
    ['Europe/Berlin', '2026-10-24', '22:00', '06:00', 9],
    ['Europe/Berlin', '2026-03-28', '22:00', '06:00', 7],
  ])(
    '%s %s keeps only explicit %s–%s working time (%s h)',
    (zone, date, startLocal, endLocal, hours) => {
      const definition = threeShifts(zone);
      definition.holidays = [
        {
          date: date,
          name: 'Reduced production',
          treatment: 'reduced',
          workingIntervals: [{ startLocal: startLocal, endLocal: endLocal }],
        },
      ];
      const { instances, warnings } = generateShifts(definition, {
        from: date,
        to: date,
      });
      expect(
        instances
          .filter((s) => !s.isExcluded)
          .reduce((sum, s) => sum + seconds(s), 0),
      ).toBe(Number(hours) * 3600);
      expect(
        instances
          .filter((s) => s.isExcluded)
          .every((s) => s.exclusionKind === 'holiday'),
      ).toBe(true);
      expect(warnings.some((w) => w.code === 'holiday_reduced')).toBe(false);
    },
  );
  it('rejects invalid explicit local windows', () => {
    const definition = threeShifts('UTC');
    definition.holidays = [
      {
        date: '2026-10-17',
        name: 'Bad window',
        treatment: 'reduced',
        workingIntervals: [{ startLocal: '30:00', endLocal: '10:00' }],
      },
    ];
    expect(() =>
      generateShifts(definition, { from: '2026-10-17', to: '2026-10-17' }),
    ).toThrow(CalendarDefinitionError);
  });
});
