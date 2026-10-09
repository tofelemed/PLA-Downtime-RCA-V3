import * as fs from 'fs';
import * as path from 'path';
import {
  LossEvent,
  PeriodAccountingInput,
  SliceInput,
} from '../../src/domain/accounting/accounting.types';
import { computePeriodAccounting } from '../../src/domain/accounting/period-accounting';
import { Dec, formatDec } from '../../src/domain/actuals/decimal';
import { combine, groupTerms } from '../../src/domain/kpi/aggregate';
import { KpiDraft } from '../../src/domain/kpi/kpi.types';
import { computePeriodKpis } from '../../src/domain/kpi/period-kpis';
import { reconciledOee } from '../../src/domain/kpi/reconciled-oee';

/**
 * Spec §19 T20 (operational OEE), T21 (reconciled PLA OEE), T31 (sum-then-divide aggregation) and T41
 * (no-data OEE) through the plan 2.7 KPI engine. Persisted results run in `kpi-results.int-spec.ts`.
 */
type Json = Record<string, unknown>;
const fixture = (id: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, `${id}.json`), 'utf8')) as {
    inputs: Json;
    expected: Json;
  };

const T0 = Date.parse('2027-03-03T02:30:00Z');
const at = (minutes: number) => new Date(T0 + minutes * 60_000);
const TOLERANCE = new Dec('0.000001');

function stop(from: number, to: number): LossEvent {
  return {
    eventId: 'stop',
    revisionId: null,
    revision: null,
    occurrenceId: 'occ-stop',
    physicalType: 'downtime',
    start: at(from),
    end: at(to),
    scheduleClass: 'unplanned',
    oeeComponent: 'availability',
    impactMode: 'full_stop',
    impactFraction: null,
    quantity: null,
    reasonCodeId: null,
    impactCodeId: null,
    failureMode: null,
  };
}

function periodInput(
  slice: Partial<SliceInput>,
  extra: Partial<PeriodAccountingInput> = {},
): PeriodAccountingInput {
  const window = { start: at(0), end: at(480) };
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
        window,
        uom: 'units',
        sustainedRates: [
          { id: 'r', rate: '2', timebase: 'min', from: at(-1000), to: null },
        ],
        planningRates: [],
        target: null,
        actuals: { gross: '756', good: '718.2', uom: 'units' },
        concurrent: false,
        ...slice,
      },
    ],
  };
}

function kpis(input: PeriodAccountingInput): KpiDraft[] {
  const accounting = computePeriodAccounting(input);
  return computePeriodKpis({
    accounting: input,
    totals: accounting.totals,
    occurrences: [],
    failures: [],
  });
}

const periodKpi = (all: KpiDraft[], metric: string) =>
  all.find((k) => k.metric === metric && k.scope.level === 'period')!;

const close = (actual: Dec | null, expected: unknown) =>
  actual !== null &&
  actual
    .minus(expected as string)
    .abs()
    .lte(TOLERANCE);

describe('T20 operational OEE (KPI01)', () => {
  const { expected } = fixture('T20');
  const input = periodInput({}, { events: [stop(60, 120)] });
  const all = kpis(input);

  it('R 25200 s; A 87.5 %, P 90 %, Q 95 %, OEE 74.8125 %', () => {
    const availability = periodKpi(all, 'availability');
    expect(formatDec(availability.numerator!)).toBe(expected.runTimeSeconds);
    for (const metric of ['availability', 'performance', 'quality', 'oee']) {
      const kpi = periodKpi(all, metric);
      expect(close(kpi.value, expected[metric])).toBe(true);
      expect(kpi.quality).toBe('ok');
    }
    expect(formatDec(periodKpi(all, 'oee').denominator!)).toBe('28800');
  });

  it('loss quantities 120 / 84 / 37.8 and good + losses = 960 (capacity ledger)', () => {
    const totals = computePeriodAccounting(input).totals.find(
      (t) => t.ledger === 'capacity',
    )!;
    expect(formatDec(totals.availability!)).toBe(expected.availabilityLossQty);
    expect(formatDec(totals.performance!)).toBe(expected.performanceLossQty);
    expect(formatDec(totals.quality!)).toBe(expected.qualityLossQty);
    const sum = totals
      .good!.plus(totals.availability!)
      .plus(totals.performance!)
      .plus(totals.quality!);
    expect(formatDec(sum)).toBe(expected.goodPlusLossesEqualsCapacity);
  });

  it('the product slice carries the same factors (one slice = the period)', () => {
    const slice = all.find(
      (k) => k.metric === 'oee' && k.scope.level === 'slice',
    )!;
    expect(close(slice.value, expected.oee)).toBe(true);
  });
});

describe('T21 reconciled PLA OEE (KPI04)', () => {
  const { inputs, expected } = fixture('T21');
  const result = reconciledOee(
    {
      good: new Dec(inputs.goodQty as string),
      availabilityLoss: new Dec(inputs.availabilityLossQty as string),
      performanceLoss: new Dec(inputs.performanceLossQty as string),
      qualityLoss: new Dec(inputs.qualityLossQty as string),
      uom: 't',
      incompleteReason: null,
      excluded: null,
      provisional: null,
    },
    { level: 'period' },
  );
  const of = (metric: string) => result.find((k) => k.metric === metric)!;

  it('A 90 %, P 96.6666667 %, Q 97.7011494 %, OEE 85 %, labelled reconciled', () => {
    expect(
      close(of('reconciled_availability').value, expected.availability),
    ).toBe(true);
    expect(
      close(of('reconciled_performance').value, expected.performance),
    ).toBe(true);
    expect(close(of('reconciled_quality').value, expected.quality)).toBe(true);
    expect(close(of('reconciled_oee').value, expected.oee)).toBe(true);
    for (const kpi of result) {
      expect(kpi.metric.startsWith('reconciled_')).toBe(true);
      expect(kpi.cohort?.label).toBe(expected.label);
    }
  });

  it('an incomplete loss basis makes every factor unavailable', () => {
    const partial = reconciledOee(
      {
        good: new Dec(850),
        availabilityLoss: null,
        performanceLoss: null,
        qualityLoss: null,
        uom: 't',
        incompleteReason: 'loss_basis_incomplete',
        excluded: null,
        provisional: null,
      },
      { level: 'period' },
    );
    expect(partial.every((k) => k.value === null)).toBe(true);
    expect(partial[0].reason).toBe('loss_basis_incomplete');
  });
});

describe('T31 weighted aggregation (AN03)', () => {
  const { inputs, expected } = fixture('T31');
  const periods = inputs.periods as Array<Record<string, string>>;
  const rows = periods.map((p) => ({
    numerator: new Dec(p.goodIdealSeconds),
    denominator: new Dec(p.scheduledSeconds),
    value: new Dec(p.goodIdealSeconds).div(p.scheduledSeconds),
    quality: 'ok' as const,
    reason: null,
    policyId: 'oee-policy-1',
  }));

  it('combined OEE = Σ numerators / Σ denominators = 54 %, not the 70 % mean of percentages', () => {
    const result = combine('oee', groupTerms('oee', rows));
    expect(formatDec(result.numerator!)).toBe(expected.numerator);
    expect(formatDec(result.denominator!)).toBe(expected.denominator);
    expect(formatDec(result.value!)).toBe(expected.combinedOee);
    const mean = rows[0].value.plus(rows[1].value).div(2);
    expect(formatDec(mean)).toBe(expected.meanOfPercentagesForbidden);
    expect(result.value!.eq(mean)).toBe(false);
  });

  it('different OEE policies behind one ratio are not combined', () => {
    const mixed = [rows[0], { ...rows[1], policyId: 'oee-policy-2' }];
    const result = combine('oee', groupTerms('oee', mixed));
    expect(result).toMatchObject({
      value: null,
      quality: 'unavailable',
      reason: 'incompatible_policies',
    });
  });
});

describe('T41 no-data OEE (KPI03)', () => {
  const forbidden = ['0.87', '1'];

  it('zero scheduled time → oee null, reason no_scheduled_time', () => {
    const all = kpis(
      periodInput(
        {},
        { periodExcluded: true, periodExclusionKind: 'no_demand' },
      ),
    );
    for (const metric of ['availability', 'performance', 'oee']) {
      const kpi = periodKpi(all, metric);
      expect(kpi.value).toBeNull();
      expect(kpi.reason).toBe('no_scheduled_time');
      expect(kpi.quality).toBe('unavailable');
    }
  });

  it('only good known → quality null, reason quality_evidence_missing; OEE still from good', () => {
    const all = kpis(
      periodInput({ actuals: { gross: null, good: '718.2', uom: 'units' } }),
    );
    const quality = periodKpi(all, 'quality');
    expect(quality.value).toBeNull();
    expect(quality.reason).toBe('quality_evidence_missing');
    expect(periodKpi(all, 'performance').value).toBeNull();
    const oee = periodKpi(all, 'oee');
    expect(oee.value).not.toBeNull();
    expect(forbidden).not.toContain(formatDec(oee.value!));
  });

  it('no actuals → every production factor null with the reason, never a default', () => {
    const all = kpis(periodInput({ actuals: null }));
    for (const metric of ['performance', 'quality', 'oee']) {
      const kpi = periodKpi(all, metric);
      expect(kpi.value).toBeNull();
      expect(kpi.reason).toBe('actuals_missing');
    }
    expect(periodKpi(all, 'availability').value?.toFixed()).toBe('1');
  });
});
