import * as fs from 'fs';
import * as path from 'path';
import {
  LedgerTotals,
  LossEvent,
  LossEventType,
  PeriodAccounting,
  PeriodAccountingInput,
  SliceInput,
} from '../../src/domain/accounting/accounting.types';
import { ReasonComponents } from '../../src/domain/accounting/declared.types';
import { readStopsCrossCheck } from '../../src/domain/accounting/declared-lines';
import {
  ACCOUNTING_ENGINE_VERSION,
  computePeriodAccounting,
} from '../../src/domain/accounting/period-accounting';
import { Dec, formatDec } from '../../src/domain/actuals/decimal';
import { parseDeclaredFigures } from '../../src/domain/events/declared-figures';
import { ReasonWeight } from '../../src/domain/events/reason-weights';

/**
 * Declared mode (PLA declared-mode spec §4.4, plan Global Constraint 12, D4) through the accounting
 * engine: the plan ledger is the OT system's declared shortfall split by reason share, stops give no
 * lines, the capacity ledger is not computed. Fixtures D01–D08 hold one or more cases each.
 */
interface FixtureEvent {
  id: string;
  type: LossEventType;
  start: string;
  end: string;
  reasonCodeId?: string;
  reasonWeights?: ReasonWeight[];
  quantity?: string;
  declaredFigures?: Record<string, unknown>;
}

interface FixtureLine {
  kind: string;
  reasonCodeId: string;
  quantity: string;
  share: string;
  basis: string;
  causeEventId?: string;
}

interface FixtureCase {
  name: string;
  inputs: {
    policy: {
      lossBasis: 'declared';
      targetSource: 'plan' | 'declared';
      stopsCrossCheck: boolean;
      identityTolerance: string;
    };
    slice: {
      uom: string;
      target: string | null;
      gross: string;
      good: string;
      planningRate: string | null;
    };
    events: FixtureEvent[];
  };
  expected: {
    lines: FixtureLine[];
    totals: Record<string, string | null>;
    flags?: string[];
    absentFlags?: string[];
    crossCheck?: { quantity: string; uom: string };
    noCrossCheck?: boolean;
    issues: number;
  };
}

interface Fixture {
  id: string;
  window: { start: string; end: string };
  reasonComponents: ReasonComponents;
  cases: FixtureCase[];
}

const FIXTURES = [
  'D01',
  'D02',
  'D03',
  'D04',
  'D05',
  'D06',
  'D07',
  'D08',
  'D09',
];
const fixture = (id: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, `${id}.json`), 'utf8'),
  ) as Fixture;

function lossEvent(given: FixtureEvent): LossEvent {
  const declared = given.type === 'production_loss';
  return {
    eventId: given.id,
    revisionId: `rev-${given.id}`,
    revision: 1,
    occurrenceId: `occ-${given.id}`,
    physicalType: given.type,
    start: new Date(given.start),
    end: new Date(given.end),
    scheduleClass: 'unplanned',
    oeeComponent: declared ? 'none' : 'availability',
    impactMode: given.type === 'downtime' ? 'full_stop' : 'measured',
    impactFraction: null,
    quantity: declared
      ? String(given.declaredFigures?.shortfall)
      : (given.quantity ?? null),
    reasonCodeId: given.reasonCodeId ?? null,
    reasonWeights: given.reasonWeights ?? null,
    impactCodeId: null,
    failureMode: null,
    ...(declared
      ? { declaredFigures: parseDeclaredFigures(given.declaredFigures) }
      : {}),
  };
}

function sliceOf(
  given: FixtureCase['inputs']['slice'],
  window: { start: Date; end: Date },
): SliceInput {
  const rate = (value: string) => ({
    id: 'plan-rate',
    rate: value,
    timebase: 'h' as const,
    from: new Date('2027-01-01T00:00:00Z'),
    to: null,
  });
  return {
    sliceId: 'S1',
    window,
    uom: given.uom,
    sustainedRates: null,
    planningRates: given.planningRate ? [rate(given.planningRate)] : [],
    target: given.target,
    actuals: { gross: given.gross, good: given.good, uom: given.uom },
    concurrent: false,
  };
}

function inputOf(fx: Fixture, given: FixtureCase): PeriodAccountingInput {
  const window = {
    start: new Date(fx.window.start),
    end: new Date(fx.window.end),
  };
  const { policy } = given.inputs;
  return {
    window,
    periodExcluded: false,
    periodExclusionKind: null,
    schedule: [],
    events: given.inputs.events.map(lossEvent),
    slices: [sliceOf(given.inputs.slice, window)],
    asOf: window.end,
    reasonComponents: fx.reasonComponents,
    policy: {
      microStopSeconds: 60,
      derateComponent: 'performance',
      plannedStopsInsideScheduleReduceAvailability: true,
      epsilon: '0.000001',
      lossBasis: policy.lossBasis,
      targetSource: policy.targetSource,
      stopsCrossCheck: policy.stopsCrossCheck,
      identityTolerance: Number(policy.identityTolerance),
    },
  };
}

const dec = (value: Dec | null) => (value === null ? null : formatDec(value));

function shareLines(result: PeriodAccounting): FixtureLine[] {
  return result.lines
    .filter((l) => l.kind !== 'residual')
    .map((l) => ({
      kind: l.kind,
      reasonCodeId: l.cause?.reasonCodeId ?? '',
      quantity: formatDec(l.quantity),
      share: l.evidence[0]?.share ?? '',
      basis: l.basis,
      causeEventId: l.cause?.eventId,
    }));
}

function expectTotals(totals: LedgerTotals, expected: FixtureCase['expected']) {
  const record = totals as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected.totals)) {
    const actual = record[key] as Dec | null;
    expect([key, dec(actual)]).toEqual([key, value]);
  }
  for (const flag of expected.flags ?? []) expect(totals.flags).toContain(flag);
  for (const flag of expected.absentFlags ?? [])
    expect(totals.flags).not.toContain(flag);
}

describe('declared-mode accounting (D01–D09)', () => {
  it('records the engine version of declared mode', () => {
    expect(ACCOUNTING_ENGINE_VERSION).toBe('2.9.0');
  });

  for (const id of FIXTURES) {
    const fx = fixture(id);
    describe(`${id}`, () => {
      for (const given of fx.cases) {
        it(given.name, () => {
          const result = computePeriodAccounting(inputOf(fx, given));
          const { expected } = given;
          expect(result.issues).toHaveLength(expected.issues);
          const lines = shareLines(result);
          expect(lines).toEqual(
            expected.lines.map((l) => ({ causeEventId: 'PL1', ...l })),
          );
          expect(result.totals).toHaveLength(1);
          const [totals] = result.totals;
          expect(totals.ledger).toBe('plan');
          expectTotals(totals, expected);
          const check = readStopsCrossCheck(totals.flags);
          if (expected.crossCheck)
            expect(check).toEqual({ stops_cross_check: expected.crossCheck });
          if (expected.noCrossCheck) expect(check).toBeNull();
        });
      }
    });
  }

  it('every line is a plan line on the declared basis, never a stop line', () => {
    const fx = fixture('D08');
    const result = computePeriodAccounting(inputOf(fx, fx.cases[0]));
    expect(result.lines.every((l) => l.ledger === 'plan')).toBe(true);
    expect(
      result.lines.filter((l) => l.kind !== 'residual').map((l) => l.basis),
    ).toEqual(['declared']);
    expect(result.lines.some((l) => l.cause?.physicalType === 'downtime')).toBe(
      false,
    );
  });

  it('a residual line carries the signed residual (plan identity)', () => {
    const fx = fixture('D04');
    const result = computePeriodAccounting(inputOf(fx, fx.cases[1]));
    const residual = result.lines.find((l) => l.kind === 'residual');
    expect(residual && formatDec(residual.quantity)).toBe('-2');
  });
});
