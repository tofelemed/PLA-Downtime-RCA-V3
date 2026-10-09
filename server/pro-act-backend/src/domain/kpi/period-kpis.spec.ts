import fc from 'fast-check';
import {
  LossEvent,
  PeriodAccountingInput,
  SliceInput,
} from '../accounting/accounting.types';
import { computePeriodAccounting } from '../accounting/period-accounting';
import { Dec } from '../actuals/decimal';
import { unionSeconds } from '../time/interval-algebra';
import { OccurrenceSpan } from './downtime-measures';
import { KpiDraft, KpiMetric } from './kpi.types';
import { computePeriodKpis } from './period-kpis';
import { FailureSpan } from './reliability';

const T0 = Date.parse('2027-03-03T02:30:00Z');
const at = (seconds: number) => new Date(T0 + seconds * 1000);
const HOUR = 3600;

function event(
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

function input(
  extra: Partial<PeriodAccountingInput> = {},
  slice: Partial<SliceInput> = {},
): PeriodAccountingInput {
  const window = { start: at(0), end: at(8 * HOUR) };
  return {
    window,
    periodExcluded: false,
    periodExclusionKind: null,
    schedule: [],
    events: [],
    asOf: window.end,
    policy: {
      microStopSeconds: 60,
      derateComponent: 'performance',
      plannedStopsInsideScheduleReduceAvailability: true,
      epsilon: '0.000001',
    },
    ...extra,
    slices: [
      {
        sliceId: 'S1',
        productId: 'P1',
        window,
        uom: 't',
        sustainedRates: [
          { id: 'r', rate: '100', timebase: 'h', from: at(-HOUR), to: null },
        ],
        planningRates: [],
        target: null,
        actuals: {
          gross: '600',
          good: '570',
          uom: 't',
          qualityState: 'complete',
          coverageRatio: '1',
        },
        concurrent: false,
        ...slice,
      },
    ],
  };
}

/** Occurrence spans as the loader derives them (min start, max end over the events). */
function spans(events: readonly LossEvent[]): OccurrenceSpan[] {
  const byId = new Map<string, OccurrenceSpan>();
  for (const e of events) {
    const seen = byId.get(e.occurrenceId);
    if (!seen) {
      byId.set(e.occurrenceId, {
        occurrenceId: e.occurrenceId,
        start: e.start,
        end: e.end,
      });
      continue;
    }
    seen.start = e.start < seen.start ? e.start : seen.start;
    seen.end =
      seen.end === null || e.end === null
        ? null
        : e.end > seen.end
          ? e.end
          : seen.end;
  }
  return [...byId.values()];
}

function run(
  source: PeriodAccountingInput,
  failures: FailureSpan[] = [],
  occurrences?: OccurrenceSpan[],
): KpiDraft[] {
  return computePeriodKpis({
    accounting: source,
    totals: computePeriodAccounting(source).totals,
    occurrences: occurrences ?? spans(source.events),
    failures,
  });
}

const period = (all: KpiDraft[], metric: KpiMetric) =>
  all.find((k) => k.metric === metric && k.scope.level === 'period')!;
const str = (value: Dec | null) => (value === null ? null : value.toFixed());

describe('KPI02 time model', () => {
  it('a 45 s micro-stop stays in R (performance), a 90 s stop is availability time', () => {
    const micro = run(input({ events: [event('m', 600, 645)] }));
    expect(str(period(micro, 'availability').numerator)).toBe(String(8 * HOUR));
    expect(str(period(micro, 'microstop_time').value)).toBe('45');
    expect(str(period(micro, 'stop_count').value)).toBe('0');
    const stop = run(input({ events: [event('s', 600, 690)] }));
    expect(str(period(stop, 'availability').numerator)).toBe(
      String(8 * HOUR - 90),
    );
    expect(str(period(stop, 'stop_count').value)).toBe('1');
  });

  it('a planned stop inside S reduces availability (D04 default)', () => {
    const all = run(
      input({ events: [event('p', 0, HOUR, { scheduleClass: 'planned' })] }),
    );
    expect(str(period(all, 'availability').value)).toBe('0.875');
    expect(str(period(all, 'downtime_planned').value)).toBe(String(HOUR));
  });

  it('an exclusion leaves A untouched; a stop inside it affects only the onstream factor', () => {
    const excluded = {
      schedule: [
        {
          start: at(0),
          end: at(HOUR),
          excluded: true,
          exclusionKind: 'no_demand',
        },
        {
          start: at(HOUR),
          end: at(8 * HOUR),
          excluded: false,
          exclusionKind: null,
        },
      ],
      events: [event('x', 0, HOUR)],
    };
    const all = run(input(excluded));
    expect(str(period(all, 'availability').value)).toBe('1');
    expect(str(period(all, 'availability').denominator)).toBe(String(7 * HOUR));
    expect(str(period(all, 'onstream_factor').value)).toBe('0.875');
    expect(period(all, 'onstream_factor').cohort?.denominator).toBe(
      'calendar_time',
    );
  });

  it('a running period: open stops are measured to the run instant over the whole window', () => {
    const all = run(
      input({ asOf: at(4 * HOUR), events: [event('o', 3 * HOUR, null)] }),
    );
    expect(str(period(all, 'availability').denominator)).toBe(String(8 * HOUR));
    expect(str(period(all, 'downtime_total').value)).toBe(String(HOUR));
    expect(str(period(all, 'mean_stop_duration').denominator)).toBe('0');
  });

  it('incomplete actuals make P, Q and OEE provisional, A stays ok', () => {
    const all = run(
      input(
        {},
        {
          actuals: {
            gross: '600',
            good: '570',
            uom: 't',
            qualityState: 'partial',
            coverageRatio: '0.5',
          },
        },
      ),
    );
    expect(period(all, 'oee').quality).toBe('provisional');
    expect(period(all, 'availability').quality).toBe('ok');
    expect(period(all, 'coverage')).toMatchObject({ quality: 'provisional' });
    expect(str(period(all, 'coverage').value)).toBe('0.5');
  });

  it('concurrent product streams are reported per product, not combined', () => {
    const all = run(input({}, { concurrent: true }));
    expect(period(all, 'oee')).toMatchObject({
      value: null,
      reason: 'concurrent_streams',
    });
    expect(
      all.find((k) => k.metric === 'oee' && k.scope.level === 'slice')?.value,
    ).not.toBeNull();
  });
});

describe('KPI06 stop counting', () => {
  it('a stop split into two events counts once; time is the union', () => {
    const parts = [
      event('a', 600, 900, { occurrenceId: 'o1' }),
      event('b', 900, 1200, { occurrenceId: 'o1' }),
    ];
    const all = run(input({ events: parts }));
    expect(str(period(all, 'stop_count').value)).toBe('1');
    expect(str(period(all, 'downtime_total').value)).toBe('600');
    expect(str(period(all, 'mean_stop_duration').value)).toBe('600');
  });

  it('a carry-in stop is counted separately; open stops are censored from the mean', () => {
    const events = [
      event('c', -600, 300),
      event('d', 1000, 1300),
      event('e', 5000, null),
    ];
    const all = run(input({ events, asOf: at(8 * HOUR) }));
    expect(str(period(all, 'carry_in_count').value)).toBe('1');
    expect(str(period(all, 'stop_count').value)).toBe('2');
    const mean = period(all, 'mean_stop_duration');
    expect(str(mean.denominator)).toBe('2');
    expect(str(mean.numerator)).toBe(String(900 + 300));
    expect(mean.cohort).toMatchObject({
      cohort: 'completed_stops_ending_in_window',
      openCensored: 1,
    });
  });

  it('breakdowns add up to the period total in every dimension (fast-check)', () => {
    const stopArb = fc.record({
      from: fc.integer({ min: -1800, max: 28000 }),
      len: fc.integer({ min: 1, max: 4000 }),
      reason: fc.constantFrom('r1', 'r2', null),
    });
    fc.assert(
      fc.property(
        fc.array(stopArb, { minLength: 1, maxLength: 6 }),
        (stops) => {
          const events = stops.map((s, i) =>
            event(`e${i}`, s.from, s.from + s.len, { reasonCodeId: s.reason }),
          );
          const all = run(input({ events }));
          const total = period(all, 'downtime_total').value!;
          const union = unionSeconds(
            events
              .map((e) => ({
                start: new Date(Math.max(e.start.getTime(), T0)),
                end: new Date(Math.min(e.end!.getTime(), T0 + 8 * HOUR * 1000)),
              }))
              .filter((p) => p.end > p.start),
          );
          expect(total.minus(union).abs().lt('0.0001')).toBe(true);
          for (const dimension of ['none', 'reason', 'asset']) {
            const cells = all.filter(
              (k) =>
                k.metric === 'downtime_total' &&
                k.scope.dimension === dimension,
            );
            const sum = cells.reduce((s, k) => s.plus(k.value!), new Dec(0));
            expect(sum.minus(total).abs().lt('0.0001')).toBe(true);
          }
        },
      ),
    );
  });
});

describe('KPI07 / KPI08 reliability', () => {
  const failure = (
    id: string,
    from: number,
    to: number | null,
    extra: Partial<FailureSpan> = {},
  ): FailureSpan => ({
    occurrenceId: id,
    assetId: 'pump',
    start: at(from),
    end: to === null ? null : at(to),
    source: 'unplanned_stop_with_failure_code',
    repairStart: null,
    repairEnd: null,
    ...extra,
  });

  it('zero failures → mtbf null with the exposure and count kept', () => {
    const all = run(input({ events: [event('s', 0, HOUR)] }));
    expect(period(all, 'mtbf')).toMatchObject({
      value: null,
      reason: 'no_failures',
      quality: 'unavailable',
    });
    expect(str(period(all, 'mtbf').numerator)).toBe(String(7 * HOUR));
    expect(str(period(all, 'mtbf').denominator)).toBe('0');
  });

  it('no repair evidence → mean downtime to restore populated, mttr null', () => {
    const all = run(input(), [
      failure('f1', 600, 1800),
      failure('f2', 3600, null),
    ]);
    expect(str(period(all, 'mtbf').value)).toBe(String((8 * HOUR) / 2));
    const mdtr = period(all, 'mean_downtime_to_restore');
    expect(str(mdtr.value)).toBe('1200');
    expect(mdtr.cohort).toMatchObject({
      label: 'mean downtime to restore',
      openCensored: 1,
    });
    expect(period(all, 'mttr')).toMatchObject({
      value: null,
      reason: 'repair_evidence_missing',
    });
    const asset = all.find(
      (k) => k.metric === 'mtbf' && k.scope.assetId === 'pump',
    );
    expect(str(asset?.denominator ?? null)).toBe('2');
  });

  it('repair evidence gives MTTR; micro failures and duplicate work orders do not count', () => {
    const repaired = failure('f1', 600, 1800, {
      repairStart: at(900),
      repairEnd: at(1500),
    });
    const micro = failure('f2', 2000, 2030);
    const order = failure('wo', 700, 5000, { source: 'failure_work_order' });
    const all = run(input(), [repaired, micro, order]);
    expect(str(period(all, 'mttr').value)).toBe('600');
    expect(str(period(all, 'mtbf').denominator)).toBe('1');
  });
});
