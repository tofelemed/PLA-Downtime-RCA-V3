import * as fs from 'fs';
import * as path from 'path';
import {
  LossEvent,
  LossLineDraft,
  PeriodAccountingInput,
  TransitionStandard,
} from '../../src/domain/accounting/accounting.types';
import { computePeriodAccounting } from '../../src/domain/accounting/period-accounting';
import { Dec, formatDec } from '../../src/domain/actuals/decimal';

/**
 * GT01 (LA-08): an HDPE grade transition A→B priced against the transition matrix through the plan 2.5
 * accounting engine — allowance and overrun in both ledgers, a reference off-grade quantity, and a
 * product change without a matrix entry. Persisted in `grade-transitions.int-spec.ts`.
 */
type Json = Record<string, string>;
const gt01 = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'GT01.json'), 'utf8'),
) as { inputs: Json; expected: Record<string, Json | string> };
const want = (key: string) => gt01.expected[key] as Json;

const T0 = Date.parse('2027-03-03T00:00:00Z');
const at = (hours: number) => new Date(T0 + hours * 3_600_000);

const transition: LossEvent = {
  eventId: 'GT',
  revisionId: 'rev-GT',
  revision: 1,
  occurrenceId: 'GT',
  physicalType: 'grade_transition',
  start: at(2),
  end: at(5),
  scheduleClass: 'planned',
  oeeComponent: 'performance',
  impactMode: 'measured',
  impactFraction: null,
  quantity: '40',
  reasonCodeId: null,
  impactCodeId: null,
  failureMode: null,
  transition: { fromProductId: 'A', toProductId: 'B' },
};

function standard(extra: Partial<TransitionStandard> = {}): TransitionStandard {
  return {
    id: 'AB',
    fromProductId: 'A',
    toProductId: 'B',
    referenceSeconds: '7560',
    referenceOffgradeQuantity: null,
    from: at(-1000),
    to: null,
    ...extra,
  };
}

interface RunOptions {
  target?: string;
  transitionAllowanceInPlan?: 'planned' | 'loss';
  event?: Partial<LossEvent>;
  actuals?: { gross: string; good: string };
}

function run(standards: TransitionStandard[], options: RunOptions = {}) {
  const window = { start: at(0), end: at(8) };
  const rates = (id: string) => [
    {
      id,
      rate: gt01.inputs.sustainedRatePerHour,
      timebase: 'h' as const,
      from: at(-100),
      to: null,
    },
  ];
  const input: PeriodAccountingInput = {
    window,
    periodExcluded: false,
    periodExclusionKind: null,
    schedule: [],
    events: [{ ...transition, ...options.event }],
    asOf: window.end,
    transitionStandards: standards,
    policy: {
      microStopSeconds: 60,
      derateComponent: 'performance',
      plannedStopsInsideScheduleReduceAvailability: true,
      epsilon: '0.000001',
      transitionAllowanceInPlan: options.transitionAllowanceInPlan,
    },
    slices: [
      {
        sliceId: 'S1',
        window,
        uom: 't',
        sustainedRates: rates('sus'),
        planningRates: rates('plan'),
        target: options.target ?? gt01.inputs.target,
        actuals: {
          gross: options.actuals?.gross ?? gt01.inputs.gross,
          good: options.actuals?.good ?? gt01.inputs.good,
          uom: 't',
        },
        concurrent: false,
      },
    ],
  };
  return computePeriodAccounting(input);
}

const total = (
  lines: readonly LossLineDraft[],
  ledger: string,
  kind: string,
  component?: string,
) =>
  formatDec(
    lines
      .filter(
        (l) =>
          l.ledger === ledger &&
          l.kind === kind &&
          (!component || l.oeeComponent === component),
      )
      .reduce((s, l) => s.plus(l.quantity), new Dec(0)),
  );

describe('GT01 grade transition against the transition matrix (engine 2.5.6)', () => {
  const result = run([standard()]);
  const capacity = result.totals.find((t) => t.ledger === 'capacity')!;
  const plan = result.totals.find((t) => t.ledger === 'plan')!;

  it('capacity: P 50 and Q 40 hold the transition; 63 t allowed, 27 t overrun; residual 0', () => {
    const c = want('capacity');
    expect(result.issues).toEqual([]);
    expect(formatDec(capacity.performance!)).toBe(c.performance);
    expect(formatDec(capacity.quality!)).toBe(c.quality);
    expect(formatDec(capacity.residual!)).toBe(c.residual);
    const lines = result.lines;
    expect(
      total(lines, 'capacity', 'transition_allowance', 'performance'),
    ).toBe(c.allowanceRate);
    expect(total(lines, 'capacity', 'transition_allowance', 'quality')).toBe(
      c.allowanceOffGrade,
    );
    expect(total(lines, 'capacity', 'transition_excess', 'performance')).toBe(
      c.excessRate,
    );
    expect(total(lines, 'capacity', 'transition_excess', 'quality')).toBe(
      c.excessOffGrade,
    );
    const excess = lines.filter((l) => l.kind === 'transition_excess');
    expect(excess.every((l) => l.flags.includes(c.excessFlag))).toBe(true);
  });

  it('plan (policy without the option = loss): the gap of 90 closes with allowance 63 and overrun 27', () => {
    const p = want('plan');
    expect(formatDec(plan.gap!)).toBe(p.gap);
    expect(total(result.lines, 'plan', 'transition_allowance')).toBe(
      p.allowance,
    );
    expect(total(result.lines, 'plan', 'transition_excess')).toBe(p.excess);
    expect(formatDec(plan.residual!)).toBe(p.residual);
  });

  it('a reference off-grade of 30 t bounds the off-grade allowance', () => {
    const r = want('referenceOffgrade30');
    const lines = run([standard({ referenceOffgradeQuantity: '30' })]).lines;
    expect(total(lines, 'capacity', 'transition_allowance', 'quality')).toBe(
      r.allowanceOffGrade,
    );
    expect(total(lines, 'capacity', 'transition_excess', 'quality')).toBe(
      r.excessOffGrade,
    );
  });

  it('B→A has no matrix entry: the whole transition is excess, flagged, nothing invented', () => {
    const n = want('noStandard');
    const lines = run([
      standard({ fromProductId: 'B', toProductId: 'A' }),
    ]).lines;
    expect(total(lines, 'capacity', 'transition_allowance')).toBe(n.allowance);
    expect(total(lines, 'capacity', 'transition_excess')).toBe(n.excess);
    expect(
      lines
        .filter((l) => l.kind === 'transition_excess')
        .every((l) => l.flags.includes(n.excessFlag)),
    ).toBe(true);
  });

  describe('transitionAllowanceInPlan = planned: the plan target already deducts the standard transition time', () => {
    const p = want('planTransitionPlanned');
    const planned = run([standard()], {
      target: gt01.inputs.targetTransitionPlanned,
      transitionAllowanceInPlan: 'planned',
    });
    const plannedPlan = planned.totals.find((t) => t.ledger === 'plan')!;

    it('plan: no allowance line; the 27 t overrun alone closes the 27 t gap', () => {
      expect(planned.issues).toEqual([]);
      expect(formatDec(plannedPlan.gap!)).toBe(p.gap);
      expect(total(planned.lines, 'plan', 'transition_allowance')).toBe(
        p.allowance,
      );
      expect(total(planned.lines, 'plan', 'transition_excess')).toBe(p.excess);
      expect(formatDec(plannedPlan.attributed!)).toBe(p.excess);
      expect(formatDec(plannedPlan.residual!)).toBe(p.residual);
    });

    it('plan totals report the 63 t allowance as planned transition time, at the unscaled planning rate', () => {
      expect(formatDec(plannedPlan.plannedTransition!)).toBe(
        p.plannedTransition,
      );
      expect(plannedPlan.flags).toContain(p.flag);
      expect(plannedPlan.flags).not.toContain('planned_rate_scaled');
      expect(plannedPlan.flags).not.toContain('bridge_required');
    });

    it('capacity ledger is the same under both options', () => {
      const capacityOf = (r: typeof result) => ({
        lines: r.lines.filter((l) => l.ledger === 'capacity'),
        totals: r.totals.filter((t) => t.ledger === 'capacity'),
      });
      expect(capacityOf(planned)).toEqual(capacityOf(result));
    });

    it('a change that finishes inside its standard gives the time back: output above plan, no line', () => {
      const e = want('planTransitionEarly');
      const early = run([standard()], {
        target: gt01.inputs.targetTransitionPlanned,
        transitionAllowanceInPlan: 'planned',
        event: { end: at(Number(e.endHour)), quantity: e.offGrade },
        actuals: { gross: e.gross, good: e.good },
      });
      const totals = early.totals.find((t) => t.ledger === 'plan')!;
      expect(early.issues).toEqual([]);
      const planLines = early.lines.filter((l) => l.ledger === 'plan');
      // only the signed residual of the overproduction, no loss line
      expect(planLines.map((l) => l.kind)).toEqual(['residual']);
      expect(formatDec(totals.plannedTransition!)).toBe(e.plannedTransition);
      expect(formatDec(totals.overproduction!)).toBe(e.overproduction);
      expect(totals.flags).not.toContain('planned_rate_scaled');
    });

    it('loss: the same target keeps the allowance as a plan line and reports no planned transition time', () => {
      expect(plan.plannedTransition).toBeNull();
      expect(plan.flags).not.toContain(p.flag);
    });
  });
});
