import { LossEvent } from '../accounting/accounting.types';
import { Dec } from '../actuals/decimal';
import { BoundedInterval } from '../time/interval-algebra';
import {
  CalendarBasisInput,
  calendarBasisTerms,
  sumTerms,
} from './calendar-basis';
import { calendarBasisKpis, CalendarKpi } from './calendar-basis-kpis';
import { calendarDays, operationalDateOf } from './calendar-days';
import { FailureSpan } from './reliability';

/** 1 Mar 2027 06:00 Asia/Tehran (UTC+3:30): start of the plant's production day. */
const T0 = Date.parse('2027-03-01T02:30:00Z');
const HOUR = 3600;
const DAY = 24 * HOUR;
const at = (seconds: number) => new Date(T0 + seconds * 1000);

function stop(
  id: string,
  from: number,
  to: number | null,
  extra: Partial<LossEvent> = {},
): LossEvent {
  return {
    eventId: id,
    revisionId: null,
    revision: null,
    occurrenceId: extra.occurrenceId ?? id,
    physicalType: 'downtime',
    start: at(from),
    end: to === null ? null : at(to),
    scheduleClass: 'unplanned',
    oeeComponent: 'availability',
    impactMode: 'full_stop',
    impactFraction: null,
    quantity: null,
    reasonCodeId: null,
    impactCodeId: null,
    failureMode: null,
    ...extra,
  };
}

const spanOf = (events: readonly LossEvent[]) =>
  [...new Set(events.map((e) => e.occurrenceId))].map((occurrenceId) => {
    const own = events.filter((e) => e.occurrenceId === occurrenceId);
    return {
      occurrenceId,
      start: new Date(Math.min(...own.map((e) => e.start.getTime()))),
      end: own.some((e) => e.end === null)
        ? null
        : new Date(Math.max(...own.map((e) => (e.end as Date).getTime()))),
    };
  });

function input(
  events: LossEvent[],
  extra: Partial<CalendarBasisInput> = {},
): CalendarBasisInput {
  const days: BoundedInterval[] = [{ start: at(0), end: at(DAY) }];
  return {
    days,
    asOf: at(2 * DAY),
    events,
    occurrences: spanOf(events),
    failures: [],
    policy: { microStopSeconds: 60, overlapAllocation: 'first_out' },
    ...extra,
  };
}

const kpi = (kpis: CalendarKpi[], metric: string) =>
  kpis.find((k) => k.metric === metric) as CalendarKpi;
const text = (value: Dec | null) => (value === null ? null : value.toFixed());

describe('calendarDays (plant production days over calendar time)', () => {
  it('cuts a UTC window at the 06:00 Asia/Tehran day start and clips both ends', () => {
    const days = calendarDays(
      {
        start: new Date('2027-03-01T00:00:00Z'),
        end: new Date('2027-03-03T00:00:00Z'),
      },
      'Asia/Tehran',
      '06:00:00',
    );
    expect(
      days.map((d) => [
        d.localDate,
        d.start.toISOString(),
        d.end.toISOString(),
      ]),
    ).toEqual([
      ['2027-02-28', '2027-03-01T00:00:00.000Z', '2027-03-01T02:30:00.000Z'],
      ['2027-03-01', '2027-03-01T02:30:00.000Z', '2027-03-02T02:30:00.000Z'],
      ['2027-03-02', '2027-03-02T02:30:00.000Z', '2027-03-03T00:00:00.000Z'],
    ]);
  });

  it('a spring-forward day is 23 h long, never forced to 24 h', () => {
    const [day] = calendarDays(
      {
        start: new Date('2027-03-27T23:00:00Z'),
        end: new Date('2027-03-28T22:00:00Z'),
      },
      'Europe/Berlin',
      '00:00',
    );
    expect(day.localDate).toBe('2027-03-28');
    expect((day.end.getTime() - day.start.getTime()) / 3_600_000).toBe(23);
  });

  it('names an instant before the day start by the previous operational date', () => {
    expect(
      operationalDateOf(
        new Date('2027-03-01T01:00:00Z'),
        'Asia/Tehran',
        '06:00',
      ),
    ).toBe('2027-02-28');
  });

  it('an empty window has no day', () => {
    const instant = new Date('2027-03-01T02:30:00Z');
    expect(
      calendarDays({ start: instant, end: instant }, 'UTC', '00:00'),
    ).toEqual([]);
  });
});

describe('calendarBasisTerms and calendarBasisKpis (plan 2.3)', () => {
  it('calendar availability = 1 − unplanned downtime ÷ calendar time; planned stops reduce only downtime', () => {
    const kpis = calendarBasisKpis(
      calendarBasisTerms(
        input([
          stop('u', 2 * HOUR, 4 * HOUR),
          stop('p', 10 * HOUR, 11 * HOUR, { scheduleClass: 'planned' }),
        ]),
      ),
    );
    expect(text(kpi(kpis, 'downtime_total').value)).toBe('10800');
    expect(text(kpi(kpis, 'downtime_unplanned').value)).toBe('7200');
    expect(text(kpi(kpis, 'stop_count').value)).toBe('2');
    const availability = kpi(kpis, 'calendar_availability');
    expect(availability.cohort.label).toBe('calendar availability');
    expect(text(availability.denominator)).toBe(String(DAY));
    expect(text(availability.value)).toBe(
      new Dec(DAY - 7200).div(DAY).toDecimalPlaces(10).toFixed(),
    );
  });

  it('clips a stop to the calendar days: the part before the window and a carry-in start are not counted', () => {
    const terms = calendarBasisTerms(input([stop('c', -2 * HOUR, 1 * HOUR)]));
    expect(terms.downtimeSeconds.toFixed()).toBe('3600');
    expect(terms.stopCount).toBe(0);
  });

  it('measures an open stop to asOf, never past the day', () => {
    const terms = calendarBasisTerms(
      input([stop('o', 20 * HOUR, null)], { asOf: at(30 * HOUR) }),
    );
    expect(terms.downtimeSeconds.toFixed()).toBe(String(4 * HOUR));
  });

  it('charges overlapping stops once (union), whatever the overlap rule', () => {
    const events = [
      stop('a', 0, 2 * HOUR),
      stop('b', HOUR, 3 * HOUR, { scheduleClass: 'planned' }),
    ];
    for (const overlapAllocation of ['first_out', 'equal_share'] as const) {
      const terms = calendarBasisTerms(
        input(events, { policy: { microStopSeconds: 60, overlapAllocation } }),
      );
      expect(terms.downtimeSeconds.toFixed()).toBe(String(3 * HOUR));
      expect(terms.stopCount).toBe(2);
    }
    const firstOut = calendarBasisTerms(input(events));
    expect(firstOut.unplannedSeconds.toFixed()).toBe(String(2 * HOUR));
    const shared = calendarBasisTerms(
      input(events, {
        policy: { microStopSeconds: 60, overlapAllocation: 'equal_share' },
      }),
    );
    expect(shared.unplannedSeconds.toFixed()).toBe(String(1.5 * HOUR));
  });

  it('keeps micro-stops in downtime but out of unplanned time and the stop count (SME D6)', () => {
    const terms = calendarBasisTerms(input([stop('m', HOUR, HOUR + 30)]));
    expect(terms.downtimeSeconds.toFixed()).toBe('30');
    expect(terms.unplannedSeconds.toFixed()).toBe('0');
    expect(terms.stopCount).toBe(0);
  });

  it('sums the days of a unit that are not contiguous', () => {
    const days = [
      { start: at(0), end: at(DAY) },
      { start: at(2 * DAY), end: at(3 * DAY) },
    ];
    const terms = calendarBasisTerms(
      input(
        [
          stop('x', DAY + HOUR, DAY + 2 * HOUR),
          stop('y', 2 * DAY, 2 * DAY + HOUR),
        ],
        {
          days,
          asOf: at(4 * DAY),
        },
      ),
    );
    expect(terms.calendarSeconds.toFixed()).toBe(String(2 * DAY));
    expect(terms.downtimeSeconds.toFixed()).toBe(String(HOUR));
    expect(terms.stopCount).toBe(1);
  });

  it('MTBF without failures is null with its exposure (no_failures)', () => {
    const mtbf = kpi(
      calendarBasisKpis(calendarBasisTerms(input([stop('u', 0, HOUR)]))),
      'mtbf',
    );
    expect(mtbf.value).toBeNull();
    expect(mtbf.reason).toBe('no_failures');
    expect(text(mtbf.numerator)).toBe(String(DAY - HOUR));
    expect(text(mtbf.denominator)).toBe('0');
    expect(mtbf.cohort.exposureBasis).toBe('calendar_run_time');
  });

  it('MTBF = calendar run time ÷ D13 failures starting in the days (micro-stop failures excluded)', () => {
    const failure = (id: string, from: number, to: number): FailureSpan => ({
      occurrenceId: id,
      assetId: null,
      start: at(from),
      end: at(to),
      source: 'unplanned_stop_with_failure_code',
      repairStart: null,
      repairEnd: null,
    });
    const terms = calendarBasisTerms(
      input([stop('f', HOUR, 3 * HOUR), stop('s', 5 * HOUR, 5 * HOUR + 20)], {
        failures: [
          failure('f', HOUR, 3 * HOUR),
          failure('s', 5 * HOUR, 5 * HOUR + 20),
        ],
      }),
    );
    expect(terms.failureCount).toBe(1);
    const mtbf = kpi(calendarBasisKpis(terms), 'mtbf');
    expect(text(mtbf.value)).toBe(String(DAY - 2 * HOUR - 20));
  });

  it('no calendar time gives no availability, never 0 % or 100 %', () => {
    const availability = kpi(
      calendarBasisKpis(sumTerms([])),
      'calendar_availability',
    );
    expect(availability.value).toBeNull();
    expect(availability.reason).toBe('no_calendar_time');
  });

  it('sums terms of several units before taking ratios', () => {
    const a = calendarBasisTerms(input([stop('a', 0, 2 * HOUR)]));
    const b = calendarBasisTerms(input([]));
    const total = sumTerms([a, b]);
    expect(total.calendarSeconds.toFixed()).toBe(String(2 * DAY));
    expect(
      text(kpi(calendarBasisKpis(total), 'calendar_availability').value),
    ).toBe(
      new Dec(2 * DAY - 2 * HOUR)
        .div(2 * DAY)
        .toDecimalPlaces(10)
        .toFixed(),
    );
  });
});
