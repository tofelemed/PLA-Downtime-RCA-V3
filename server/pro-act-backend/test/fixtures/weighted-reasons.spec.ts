import * as fs from 'fs';
import * as path from 'path';
import {
  LossEvent,
  LossLineDraft,
  OverlapAllocation,
  PeriodAccountingInput,
} from '../../src/domain/accounting/accounting.types';
import { computePeriodAccounting } from '../../src/domain/accounting/period-accounting';
import { Dec, formatDec } from '../../src/domain/actuals/decimal';
import {
  normaliseReasonWeights,
  ReasonWeight,
} from '../../src/domain/events/reason-weights';

/**
 * Tier 2 item 2.8 / D-T5 weighted multi-reason stops through the accounting engine (2.8.0): WR01 a
 * weighted stop alone, WR02 a weighted stop overlapping another stop (first_out, equal_share), WR03 a
 * weighted stop crossing a shift boundary, WR04 unweighted regressions (byte-identical lines and keys).
 */
type Json = Record<string, unknown>;
const fixture = (id: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, `${id}.json`), 'utf8')) as {
    inputs: Json;
    expected: Json;
  };

const T0 = Date.parse('2027-03-03T02:30:00Z');
const at = (hours: number) => new Date(T0 + hours * 3_600_000);

function stop(
  id: string,
  from: number,
  to: number,
  reason: { reasonCodeId: string; reasonWeights?: ReasonWeight[] | null },
): LossEvent {
  return {
    eventId: id,
    revisionId: `rev-${id}`,
    revision: 1,
    occurrenceId: `occ-${id}`,
    physicalType: 'downtime',
    start: at(from),
    end: at(to),
    scheduleClass: 'unplanned',
    oeeComponent: 'availability',
    impactMode: 'full_stop',
    impactFraction: null,
    quantity: null,
    impactCodeId: null,
    failureMode: null,
    ...reason,
  };
}

function weightsOf(record: Json): ReasonWeight[] {
  return Object.entries(record).map(([reasonCodeId, weight]) => ({
    reasonCodeId,
    weight: String(weight),
  }));
}

function run(
  events: LossEvent[],
  window = { start: at(0), end: at(8) },
  overlapAllocation: OverlapAllocation = 'first_out',
): ReturnType<typeof computePeriodAccounting> {
  const input: PeriodAccountingInput = {
    window,
    periodExcluded: false,
    periodExclusionKind: null,
    schedule: [],
    events,
    asOf: window.end,
    policy: {
      overlapAllocation,
      microStopSeconds: 60,
      derateComponent: 'performance',
      plannedStopsInsideScheduleReduceAvailability: true,
      epsilon: '0.000001',
    },
    slices: [
      {
        sliceId: 'S1',
        window,
        uom: 't',
        sustainedRates: [
          { id: 'sus', rate: '100', timebase: 'h', from: at(-100), to: null },
        ],
        planningRates: [
          { id: 'plan', rate: '90', timebase: 'h', from: at(-100), to: null },
        ],
        // the plan ledger re-bases stops at the planning rate once a target and actuals exist
        target: '720',
        actuals: { gross: '600', good: '600', uom: 't' },
        concurrent: false,
      },
    ],
  };
  return computePeriodAccounting(input);
}

const availability = (lines: LossLineDraft[], ledger = 'capacity') =>
  lines.filter((l) => l.ledger === ledger && l.kind === 'availability');

/** Σ quantity per line reason (the reason the line is stored with). */
function byReason(lines: LossLineDraft[]): Record<string, string> {
  const sums = new Map<string, Dec>();
  for (const line of lines) {
    const reason = line.cause?.reasonCodeId ?? '-';
    sums.set(reason, (sums.get(reason) ?? new Dec(0)).plus(line.quantity));
  }
  const total = [...sums.values()].reduce((s, q) => s.plus(q), new Dec(0));
  return {
    ...Object.fromEntries(
      [...sums].map(([reason, quantity]) => [reason, formatDec(quantity)]),
    ),
    availability: formatDec(total),
  };
}

describe('WR01 weighted stop alone', () => {
  const { inputs, expected } = fixture('WR01');
  const weights = inputs.reasonWeights as ReasonWeight[];
  const result = run([
    stop('E1', 2, 4, { reasonCodeId: 'R1', reasonWeights: weights }),
  ]);

  it('splits the stop 150 / 50 t (capacity) and 135 / 45 t (plan), conservation holds', () => {
    expect(result.issues).toEqual([]);
    expect(byReason(availability(result.lines))).toEqual(expected.capacity);
    expect(byReason(availability(result.lines, 'plan'))).toEqual(expected.plan);
    expect(availability(result.lines).length * 2).toBe(expected.lines);
  });

  it('keeps one evidence row per (cause event, reason) with share = segment share × weight', () => {
    for (const line of availability(result.lines)) {
      const reason = line.cause?.reasonCodeId as string;
      expect(line.evidence).toEqual([
        expect.objectContaining({
          eventId: 'E1',
          share: (expected.evidenceShares as Json)[reason],
        }),
      ]);
      expect(line.autoKey).toContain(`reason=${reason}`);
    }
  });
});

describe('WR02 weighted stop overlapping another stop', () => {
  const { inputs, expected } = fixture('WR02');
  const [first, second] = inputs.stops as Json[];
  const events = [
    stop('E1', 2, 4, {
      reasonCodeId: 'R1',
      reasonWeights: weightsOf(first.reasonWeights as Json),
    }),
    stop('E2', 3, 5, { reasonCodeId: String(second.reasonCodeId) }),
  ];

  it('first_out gives the overlap to the first stop, then splits it by weight', () => {
    const result = run(events, undefined, 'first_out');
    expect(result.issues).toEqual([]);
    expect(byReason(availability(result.lines))).toEqual(expected.first_out);
  });

  it('equal_share halves the overlap first; the weights split only the weighted stop’s half', () => {
    const result = run(events, undefined, 'equal_share');
    expect(result.issues).toEqual([]);
    expect(byReason(availability(result.lines))).toEqual(expected.equal_share);
    const shared = availability(result.lines).filter(
      (l) => l.segmentStart.getTime() === at(3).getTime(),
    );
    expect(
      Object.fromEntries(
        shared.map((l) => [l.cause?.reasonCodeId, l.evidence[0].share]),
      ),
    ).toEqual(expected.sharedSegmentShares);
  });
});

describe('WR03 weighted stop crossing a shift boundary', () => {
  const { inputs, expected } = fixture('WR03');
  const entered = inputs.enteredSeconds as Json;
  const normalised = normaliseReasonWeights(
    Object.entries(entered).map(([reasonCodeId, seconds]) => ({
      reasonCodeId,
      seconds: String(seconds),
    })),
    { durationSeconds: 7200 },
  );

  it('normalises 4800 s / 2400 s to 8-place weights adding up to 1 (remainder on the largest)', () => {
    expect(normalised).toEqual({
      ok: true,
      primary: 'R1',
      weights: inputs.reasonWeights,
    });
  });

  it('each shift carries its own hour of the stop, split by the same weights', () => {
    const weights = inputs.reasonWeights as ReasonWeight[];
    const event = stop('E1', 3, 5, {
      reasonCodeId: 'R1',
      reasonWeights: weights,
    });
    for (const window of [
      { start: at(0), end: at(4) },
      { start: at(4), end: at(8) },
    ]) {
      const result = run([event], window);
      expect(result.issues).toEqual([]);
      const lines = availability(result.lines);
      expect(byReason(lines)).toEqual(expected.perShift);
      expect(
        Object.fromEntries(
          lines.map((l) => [l.cause?.reasonCodeId, l.evidence[0].share]),
        ),
      ).toEqual(expected.evidenceShares);
    }
  });
});

describe('WR04 unweighted regression', () => {
  const plain = (reasonWeights?: ReasonWeight[] | null) => [
    stop('E1', 2, 4, {
      reasonCodeId: 'R1',
      ...(reasonWeights !== undefined ? { reasonWeights } : {}),
    }),
    stop('E2', 3, 5, { reasonCodeId: 'R3' }),
  ];
  const serialised = (events: LossEvent[], rule: OverlapAllocation) => {
    const result = run(events, undefined, rule);
    return JSON.stringify({
      issues: result.issues,
      totals: result.totals,
      lines: result.lines.map((l) => ({ ...l, cause: l.cause?.eventId })),
    });
  };

  it.each<OverlapAllocation>(['first_out', 'equal_share'])(
    'absent, null and single-reason weights give identical results (%s)',
    (rule) => {
      const baseline = serialised(plain(), rule);
      expect(serialised(plain(null), rule)).toBe(baseline);
      expect(
        serialised(plain([{ reasonCodeId: 'R1', weight: '1.00000000' }]), rule),
      ).toBe(baseline);
      expect(baseline).not.toContain('reason=');
    },
  );
});
