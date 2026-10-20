import { LossEvent } from '../accounting/accounting.types';
import { Dec, formatDec } from '../actuals/decimal';
import { CauseSeconds } from './downtime-allocation';
import { downtimeBreakdown } from './downtime-breakdown';
import { DowntimeInput } from './downtime-measures';
import { KpiDraft } from './kpi.types';

const START = new Date('2027-03-03T06:00:00Z');
const END = new Date('2027-03-03T14:00:00Z');

function stop(reasonWeights: LossEvent['reasonWeights']): LossEvent {
  return {
    eventId: 'e1',
    revisionId: 'rev-e1',
    revision: 1,
    occurrenceId: 'occ-1',
    physicalType: 'downtime',
    start: new Date('2027-03-03T07:00:00Z'),
    end: new Date('2027-03-03T08:00:00Z'),
    scheduleClass: 'unplanned',
    oeeComponent: 'availability',
    impactMode: 'full_stop',
    impactFraction: null,
    quantity: null,
    reasonCodeId: 'r-jam',
    impactCodeId: null,
    failureMode: null,
    reasonWeights,
  };
}

function breakdownOf(event: LossEvent): KpiDraft[] {
  const input: DowntimeInput = {
    window: { start: START, end: END },
    asOf: END,
    events: [event],
    microOccurrences: new Set(),
    occurrences: [
      { occurrenceId: 'occ-1', start: event.start, end: event.end },
    ],
    scheduled: { scheduled: new Dec(28_800), stopped: new Dec(3_600) },
  };
  const allocated: CauseSeconds[] = [
    {
      event,
      seconds: new Dec(3_600),
      scheduleClass: 'unplanned',
      overrun: false,
    },
  ];
  return downtimeBreakdown(input, allocated);
}

const byReason = (rows: KpiDraft[], metric: string): Record<string, string> =>
  Object.fromEntries<string>(
    rows
      .filter(
        (r) =>
          r.metric === metric &&
          r.scope.level === 'breakdown' &&
          r.scope.dimension === 'reason',
      )
      .map((r) => [
        (r.scope.level === 'breakdown' ? r.scope.key : null) ?? '',
        formatDec(r.value ?? new Dec(0)),
      ]),
  );

describe('downtime breakdown by reason (D-T5 weighted multi-reason stops)', () => {
  it('splits a weighted stop’s downtime across its reasons by weight; the parts add up to the whole', () => {
    const rows = breakdownOf(
      stop([
        { reasonCodeId: 'r-jam', weight: '0.75' },
        { reasonCodeId: 'r-motor', weight: '0.25' },
      ]),
    );
    expect(byReason(rows, 'downtime_total')).toEqual({
      'r-jam': '2700',
      'r-motor': '900',
    });
  });

  it('counts the stop once, under its primary reason, and leaves other dimensions whole', () => {
    const rows = breakdownOf(
      stop([
        { reasonCodeId: 'r-jam', weight: '0.75' },
        { reasonCodeId: 'r-motor', weight: '0.25' },
      ]),
    );
    expect(byReason(rows, 'stop_count')).toEqual({ 'r-jam': '1' });
    const total = rows.find(
      (r) =>
        r.metric === 'downtime_total' &&
        r.scope.level === 'breakdown' &&
        r.scope.dimension === 'none',
    );
    expect(formatDec(total?.value ?? new Dec(0))).toBe('3600');
  });

  it('keeps an unweighted stop under its one reason', () => {
    expect(byReason(breakdownOf(stop(null)), 'downtime_total')).toEqual({
      'r-jam': '3600',
    });
  });
});
