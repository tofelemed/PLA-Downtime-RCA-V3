import * as fs from 'fs';
import * as path from 'path';
import {
  LossLineDraft,
  PeriodAccountingInput,
} from '../../src/domain/accounting/accounting.types';
import { computePeriodAccounting } from '../../src/domain/accounting/period-accounting';
import { Dec, formatDec, ZERO } from '../../src/domain/actuals/decimal';
import {
  LotDispositionInput,
  QualityClasses,
} from '../../src/domain/actuals/period/quality-classes';
import { SourceCandidate } from '../../src/domain/actuals/period/period-actuals.types';
import { computeSliceActuals } from '../../src/domain/actuals/period/slice-actuals';
import { computePeriodKpis } from '../../src/domain/kpi/period-kpis';
import {
  ValuationContext,
  ValuationRateSnapshot,
} from '../../src/domain/valuation/valuation.types';
import { valueRunLines } from '../../src/valuation/run-valuation';

/**
 * QD01 (SME E3, V2): the good-output boundary through the period actuals (2.4.2), the accounting engine
 * (2.5.7), the KPI engine and the economic valuation — a 100 t lot with 5 t downgraded is 95 % first-pass
 * quality and $1,000 of downgrade; reprocessing the 5 t later recovers saleable output but neither erases
 * the first-pass defect nor makes 105 t of net product. Persisted in `quality-dispositions.int-spec.ts`.
 */
type Json = Record<string, string>;
const qd01 = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'QD01.json'), 'utf8'),
) as { expected: Record<string, Json> };
const want = (key: string) => qd01.expected[key];

const PROFILE = 'profile-hdpe';
const PRODUCT = 'product-hdpe';
const T0 = Date.parse('2027-03-01T00:00:00Z');
const at = (hours: number) => new Date(T0 + hours * 3_600_000);
const str = (value: Dec | null | undefined) =>
  value === null || value === undefined ? null : formatDec(value);

const meter = (gross: string, from: number): SourceCandidate => ({
  source: 'pi_counter',
  method: 'counter_delta',
  label: 'signal:totalizer',
  basis: 'gross',
  quantity: new Dec(gross),
  reject: null,
  measured: new Dec(gross),
  estimated: ZERO,
  uom: 't',
  available: true,
  observed: [{ start: at(from), end: at(from + 8) }],
  segments: [],
  findings: [],
});

const L100: LotDispositionInput = {
  id: 'L-100/downgrade',
  start: at(0),
  end: at(8),
  dispositionClass: 'downgrade',
  quantity: new Dec(5),
  uom: 't',
  remeasured: false,
};
const RECOVERY: LotDispositionInput = {
  id: 'L-100/recovery',
  start: at(9),
  end: at(10),
  dispositionClass: 'recovered',
  quantity: new Dec(5),
  uom: 't',
  remeasured: true,
};

function actuals(gross: string, from: number, lots: LotDispositionInput[]) {
  return computeSliceActuals({
    window: { from: at(from), to: at(from + 8) },
    gate: {
      requiredCoverageRatio: 1,
      allowProportionalEstimate: true,
      countApprovedSubstitutionsAsAccepted: true,
    },
    selection: { selected: meter(gross, from), role: 'primary', findings: [] },
    adjustments: [],
    uom: 't',
    dispositions: lots,
  });
}

function accountingInput(
  from: number,
  result: ReturnType<typeof actuals>,
): PeriodAccountingInput {
  const window = { start: at(from), end: at(from + 8) };
  const rate = (id: string) => [
    { id, rate: '12.5', timebase: 'h' as const, from: at(-10), to: null },
  ];
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
    slices: [
      {
        sliceId: 'S',
        productId: PRODUCT,
        window,
        uom: 't',
        sustainedRates: rate('sus'),
        planningRates: rate('plan'),
        target: '100',
        actuals: {
          gross: result.gross,
          good: result.good,
          uom: result.uom,
          qualityState: result.qualityState,
          coverageRatio: result.coverageRatio,
          classes: result.qualityClasses,
        },
        concurrent: false,
      },
    ],
  };
}

const rate = (basis: ValuationRateSnapshot['basis'], value: string) => ({
  id: `rate-${basis}`,
  version: 1,
  ownerId: PROFILE,
  basis,
  value,
  currency: 'USD',
  perUom: 't',
  from: '2027-01-01T00:00:00Z',
  to: null,
});

const VALUATION: ValuationContext = {
  engineVersion: '2.6.0',
  policy: {
    id: 'policy-3',
    version: 3,
    approved: true,
    defaultBasis: 'economic_impact',
    timeBasisRule: 'exclusive',
    currencies: ['USD'],
    fxPolicy: 'snapshot',
    independentImpactCodeIds: [],
    fx: {
      rateType: 'economic',
      dateRule: 'event_date',
      maxAverageDeviation: null,
    },
    // no impact-code map and no default: only the recorded class can value the line
    economic: {
      demandRule: 'all_lost_output',
      qualityDispositions: {},
      defaultQualityDisposition: null,
      manualLineHours: false,
    },
  },
  rates: [
    rate('contribution_margin', '300'),
    rate('downgrade_price_difference', '200'),
    rate('rework_cost', '60'),
  ],
  fx: [],
};

const qualityLines = (lines: LossLineDraft[]) =>
  lines.filter((l) => l.ledger === 'capacity' && l.kind === 'quality');

function economicUsd(
  line: LossLineDraft,
  context: ValuationContext = VALUATION,
): string | null {
  const [valuation] = valueRunLines(
    [line],
    context,
    new Map([['S', { profileId: PROFILE, productId: PRODUCT }]]),
  );
  const view = valuation.views.find((v) => v.view === 'economic_impact');
  return str(view?.amounts[0]?.amount);
}

function firstPassQuality(input: PeriodAccountingInput): string | null {
  const accounting = computePeriodAccounting(input);
  const kpis = computePeriodKpis({
    accounting: input,
    totals: accounting.totals,
    occurrences: [],
    failures: [],
  });
  const q = kpis.find(
    (k) => k.metric === 'quality' && k.scope.level === 'period',
  );
  return str(q?.value);
}

describe('QD01 good-output boundary and product disposition (SME E3)', () => {
  const p1 = actuals('100', 0, [L100]);
  const p2 = actuals('105', 8, [RECOVERY]);

  it('period 1: 95 t first-pass good of 100 t, the 5 t a downgrade quality loss worth $1,000', () => {
    const expected = want('period1');
    expect(p1).toMatchObject({
      gross: expected.gross,
      reject: expected.reject,
      good: expected.good,
    });
    const input = accountingInput(0, p1);
    expect(firstPassQuality(input)).toBe(expected.firstPassQuality);
    const [line, ...others] = qualityLines(
      computePeriodAccounting(input).lines,
    );
    expect(others).toEqual([]);
    expect(formatDec(line.quantity)).toBe(expected.qualityLoss);
    expect(line.flags).toContain(expected.qualityClass);
    expect(economicUsd(line)).toBe(expected.economicUsd);
  });

  it('period 2: the reprocessed 5 t are recovered output, not new gross, not first-pass good', () => {
    const expected = want('period2');
    expect(p2).toMatchObject({ gross: expected.gross, good: expected.good });
    const classes = p2.qualityClasses as QualityClasses;
    expect(classes.recovered).toBe(expected.recovered);
    expect(classes.reprocessedInput).toBe(expected.reprocessedInput);
    const input = accountingInput(8, p2);
    expect(qualityLines(computePeriodAccounting(input).lines)).toEqual([]);
    expect(firstPassQuality(input)).toBe(expected.firstPassQuality);
  });

  it('both periods: 200 t of fresh output is 200 t of product (good + recovered), never 205 t', () => {
    const expected = want('bothPeriods');
    const fresh = new Dec(p1.gross ?? '0').plus(p2.gross ?? '0');
    const product = new Dec(p1.good ?? '0')
      .plus(p2.good ?? '0')
      .plus(p2.qualityClasses?.recovered ?? '0');
    expect(formatDec(fresh)).toBe(expected.freshGross);
    expect(formatDec(product)).toBe(expected.goodPlusRecovered);
    // the recovery does not touch period 1: its first-pass defect stays
    expect(actuals('100', 0, [L100, RECOVERY]).good).toBe(want('period1').good);
  });

  it('rework variant: 5 t sent to rework and fully recovered through the same boundary cost the rework cost only', () => {
    const expected = want('reworkVariant');
    const rework = actuals('100', 0, [{ ...L100, dispositionClass: 'rework' }]);
    const [line] = qualityLines(
      computePeriodAccounting(accountingInput(0, rework)).lines,
    );
    expect(line.flags).toContain(expected.qualityClass);
    // 2.8.0: the recorded recovery returns all 5 t (no yield loss); being remeasured, its reprocessing
    // time is lost output of period 2's own ledger, so no displaced contribution is added here
    const lots: ValuationContext = {
      ...VALUATION,
      reworkLots: [
        {
          id: 'L-100/rework',
          productId: PRODUCT,
          start: at(0).toISOString(),
          end: at(8).toISOString(),
          quantity: '5',
          uom: 't',
          recoveries: [
            {
              id: RECOVERY.id,
              start: RECOVERY.start.toISOString(),
              end: RECOVERY.end.toISOString(),
              quantity: '5',
              remeasured: true,
              sameUnit: true,
            },
          ],
        },
      ],
    };
    expect(economicUsd(line, lots)).toBe(expected.economicUsd);
    // without the recorded recovery the rework time is estimated at the planned rate: + 5 t × $300 displaced
    expect(economicUsd(line)).toBe(expected.economicUsdUnrecorded);
  });
});
