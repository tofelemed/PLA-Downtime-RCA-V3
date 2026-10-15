import * as fs from 'fs';
import * as path from 'path';
import { Dec, formatDec } from '../../src/domain/actuals/decimal';
import { ValuationBasis } from '../../src/domain/profiles/profile.types';
import { manualLineHours } from '../../src/domain/valuation/manual-line-hours';
import { reconciledValuation } from '../../src/domain/valuation/reconciled-valuation';
import { valueLine } from '../../src/domain/valuation/value-line';
import {
  loadLineValuation,
  storeLineValuation,
} from '../../src/domain/valuation/valuation-snapshot';
import {
  parseValuationPolicy,
  VALUATION_POLICY_V3_BODY,
  ValuationPolicyError,
} from '../../src/domain/valuation/valuation-policy';
import {
  DemandStatusSnapshot,
  EconomicRules,
  FxRateSnapshot,
  LineViewValuation,
  ValuationContext,
  ValuationLineInput,
  ValuationPolicySnapshot,
  ValuationRateSnapshot,
} from '../../src/domain/valuation/valuation.types';

/**
 * SME answers of 14 Oct 2026, Part C, on the pure valuation domain with the answers' own worked numbers
 * (illustrative magnitudes, not plant data): V2 scrap / downgrade / rework, V3 demand-constrained lost
 * sales, V4 verified hours of manual lines, V5 / V6 the FX basis and the month average, V8 the default view.
 */
const PROFILE = '11111111-1111-4111-8111-111111111111';
const PRODUCT = '44444444-4444-4444-8444-444444444444';
const SCRAP_CODE = '55555555-5555-4555-8555-555555555555';
const DOWNGRADE_CODE = '66666666-6666-4666-8666-666666666666';
const REWORK_CODE = '77777777-7777-4777-8777-777777777777';
const STOP_CODE = '88888888-8888-4888-8888-888888888888';
const T0 = new Date('2027-03-03T06:00:00Z');
const HOUR = 3_600_000;
const str = (value: Dec | null) => (value === null ? null : formatDec(value));

const RULES: EconomicRules = {
  demandRule: 'demand_constrained_only',
  qualityDispositions: {
    [SCRAP_CODE]: 'scrap',
    [DOWNGRADE_CODE]: 'downgrade',
    [REWORK_CODE]: 'rework',
  },
  defaultQualityDisposition: null,
  manualLineHours: true,
};

function policy(
  overrides: Partial<ValuationPolicySnapshot> = {},
): ValuationPolicySnapshot {
  return {
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
    economic: RULES,
    ...overrides,
  };
}

const rate = (
  basis: ValuationBasis,
  value: string,
  overrides: Partial<ValuationRateSnapshot> = {},
): ValuationRateSnapshot => ({
  id: `rate-${basis}`,
  version: 1,
  ownerId: basis === 'cost_per_hour' ? STOP_CODE : PROFILE,
  basis,
  value,
  currency: 'USD',
  perUom: basis === 'cost_per_hour' ? 'h' : 't',
  from: '2027-01-01T00:00:00Z',
  to: null,
  ...overrides,
});

/** V2 illustration: price $1,000/t, avoidable cost $700/t, contribution $300/t, salvage $50/t. */
const V2_RATES = [
  rate('contribution_margin', '300'),
  rate('variable_cost', '700'),
  rate('salvage_value', '50'),
  rate('downgrade_price_difference', '200'),
  rate('rework_cost', '60'),
  rate('cost_per_hour', '500'),
];

const demand = (constrained: boolean): DemandStatusSnapshot => ({
  id: constrained ? 'demand-sold-out' : 'demand-slack',
  version: 1,
  productId: PRODUCT,
  constrained,
  from: '2027-03-01T00:00:00Z',
  to: '2027-04-01T00:00:00Z',
});

function context(
  overrides: Partial<ValuationContext> = {},
  policyOverrides: Partial<ValuationPolicySnapshot> = {},
): ValuationContext {
  return {
    engineVersion: '2.6.0',
    policy: policy(policyOverrides),
    rates: V2_RATES,
    fx: [],
    demand: [demand(true)],
    ...overrides,
  };
}

function line(overrides: Partial<ValuationLineInput> = {}): ValuationLineInput {
  return {
    kind: 'availability',
    quantity: new Dec(10),
    uom: 't',
    start: T0,
    end: new Date(T0.getTime() + HOUR),
    seconds: null,
    profileId: PROFILE,
    impactCodeId: null,
    productId: PRODUCT,
    ...overrides,
  };
}

function economic(
  input: ValuationLineInput,
  ctx = context(),
): LineViewValuation {
  const found = valueLine(input, ctx).views.find(
    (v) => v.view === 'economic_impact',
  );
  if (!found) throw new Error('no economic view');
  return found;
}

const usd = (view: LineViewValuation) => str(view.amounts[0].amount);
const quality = (impactCodeId: string | null) =>
  line({ kind: 'quality', impactCodeId, start: T0, end: T0 });

describe('V2 scrap, downgrade and rework (non-overlapping economic parts)', () => {
  it('10 t never made and never sold lose $3,000 of contribution', () => {
    const view = economic(line());
    expect(usd(view)).toBe('3000');
    expect(view.components.map((c) => c.component)).toEqual([
      'lost_contribution',
    ]);
  });

  it('10 t scrapped with no replacement sale and $50/t salvage lose $3,000 + $7,000 − $500 = $9,500', () => {
    const view = economic(quality(SCRAP_CODE));
    expect(usd(view)).toBe('9500');
    expect(view.components.map((c) => [c.component, str(c.amount)])).toEqual([
      ['lost_contribution', '3000'],
      ['variable_cost', '7000'],
      ['salvage', '-500'],
    ]);
    expect(view.notes).toEqual(['disposition_scrap', 'no_disposal_rate']);
  });

  it('scrap whose sale is recovered keeps only the wasted cost: $7,000 − $500 = $6,500', () => {
    const view = economic(
      quality(SCRAP_CODE),
      context({ demand: [demand(false)] }),
    );
    expect(usd(view)).toBe('6500');
    expect(view.notes).toContain('demand_not_constrained');
  });

  it('10 t sold at $800/t instead of $1,000/t lose $2,000 (no lost contribution: the sale happened)', () => {
    const view = economic(quality(DOWNGRADE_CODE), context({ demand: [] }));
    expect(usd(view)).toBe('2000');
    expect(view.components.map((c) => c.component)).toEqual([
      'price_difference',
    ]);
  });

  it('10 t reworked at $60/t with full sales recovered and spare capacity cost $600, not another $3,000 of contribution', () => {
    const spare = economic(
      quality(REWORK_CODE),
      context({ demand: [demand(false)] }),
    );
    expect(usd(spare)).toBe('600');
    expect(spare.notes).toEqual([
      'disposition_rework',
      'no_rework_yield_rate',
      'displaced_not_constrained',
    ]);
  });

  it('a quality line without a disposition, or without a required value, stays unvalued (never zero)', () => {
    expect(economic(quality(null))).toMatchObject({
      status: 'unvalued',
      reason: 'disposition_missing',
    });
    const noCost = context({
      rates: V2_RATES.filter((r) => r.basis !== 'variable_cost'),
    });
    expect(economic(quality(SCRAP_CODE), noCost)).toMatchObject({
      status: 'unvalued',
      reason: 'variable_cost_missing',
    });
    const fallback = context(
      {},
      { economic: { ...RULES, defaultQualityDisposition: 'downgrade' } },
    );
    expect(usd(economic(quality(null), fallback))).toBe('2000');
  });
});

describe('V3 a lost tonne is a lost sale only when demand was constrained', () => {
  const stop = line({ quantity: new Dec(20) });

  it('sold out: 20 t × $300/t = $6,000 with the demand status recorded', () => {
    const view = economic(stop);
    expect(usd(view)).toBe('6000');
    expect(view.demandStatusId).toBe('demand-sold-out');
  });

  it('inventory served every order: lost-sales contribution $0, still valued, tonnes kept', () => {
    const view = economic(stop, context({ demand: [demand(false)] }));
    expect(view).toMatchObject({
      status: 'valued',
      notes: ['demand_not_constrained'],
    });
    expect(usd(view)).toBe('0');
    const margin = valueLine(stop, context({ demand: [demand(false)] }))
      .views[0];
    expect(str(margin.amounts[0].amount)).toBe('6000');
  });

  it('no approved demand status: unvalued demand_status_missing; the all-lost-output rule needs none', () => {
    expect(economic(stop, context({ demand: [] }))).toMatchObject({
      status: 'unvalued',
      reason: 'demand_status_missing',
    });
    const always = context(
      { demand: [] },
      { economic: { ...RULES, demandRule: 'all_lost_output' } },
    );
    expect(usd(economic(stop, always))).toBe('6000');
  });

  it('only v3 policies carry the view; schedule time never does', () => {
    const v2 = context(
      {},
      {
        economic: undefined,
        fx: undefined,
        defaultBasis: 'contribution_margin',
      },
    );
    expect(valueLine(stop, v2).views.map((v) => v.view)).toEqual([
      'contribution_margin',
      'standard_cost',
    ]);
    const excluded = valueLine(line({ kind: 'schedule_exclusion' }), context());
    expect(excluded.views.map((v) => v.view)).not.toContain('economic_impact');
  });
});

describe('V5 / V6 FX basis and the month average', () => {
  const MILLION = new Dec(1_000_000);
  const fx = (
    id: string,
    value: string,
    from: string,
    to: string | null,
  ): FxRateSnapshot => ({
    id,
    version: 1,
    fromCurrency: 'USD',
    toCurrency: 'IRR',
    rate: value,
    from,
    to,
  });
  const MID = '2027-03-16T12:00:00Z';
  const RATES = [
    fx('fx-600', '600000', '2027-03-01T00:00:00Z', MID),
    fx('fx-750', '750000', MID, null),
  ];
  const irrMargin = rate('contribution_margin', '600000000', {
    currency: 'IRR',
  });
  const loss = (at: string) =>
    line({
      kind: 'quality',
      quantity: new Dec(1),
      start: new Date(at),
      end: new Date(at),
      impactCodeId: null,
    });
  const ctx = (
    fxRule: ValuationPolicySnapshot['fx'],
    average?: { from: string; to: string },
  ) =>
    context(
      {
        rates: [irrMargin],
        fx: RATES,
        ...(average ? { fxAverage: average } : {}),
      },
      { currencies: ['IRR', 'USD'], fx: fxRule },
    );
  const usdOf = (input: ValuationLineInput, c: ValuationContext) =>
    valueLine(input, c).views[0].amounts.find((a) => a.currency === 'USD')!;
  const MONTH = { from: '2027-03-01T00:00:00Z', to: '2027-04-01T00:00:00Z' };
  const early = loss('2027-03-05T08:00:00Z');
  const late = loss('2027-03-25T08:00:00Z');

  it('event date: 600 million IRR at 600,000 and at 750,000 IRR/USD are $1,000 and $800 ($1,800)', () => {
    const rule = {
      rateType: 'economic' as const,
      dateRule: 'event_date' as const,
      maxAverageDeviation: null,
    };
    expect(str(usdOf(early, ctx(rule)).amount)).toBe('1000');
    expect(str(usdOf(late, ctx(rule)).amount)).toBe('800');
    expect(usdOf(early, ctx(rule)).fxRateIds).toEqual(['fx-600']);
  });

  it('month average 675,000: 1.2 billion IRR give $1,777.78, a different figure, so the rule is in the policy', () => {
    const rule = {
      rateType: 'economic' as const,
      dateRule: 'period_average' as const,
      maxAverageDeviation: null,
    };
    const total = usdOf(early, ctx(rule, MONTH)).amount!.plus(
      usdOf(late, ctx(rule, MONTH)).amount!,
    );
    expect(total.toDecimalPlaces(2).toFixed(2)).toBe('1777.78');
    expect(usdOf(early, ctx(rule, MONTH)).fxRateIds).toEqual([
      'fx-600',
      'fx-750',
    ]);
    expect(str(MILLION.mul(1200).div(675000).toDecimalPlaces(2))).toBe(
      '1777.78',
    );
  });

  it('a volatile month refuses the average (deviation 11 % > 5 %); an uncovered month or no window is fx_rate_missing', () => {
    const strict = {
      rateType: 'economic' as const,
      dateRule: 'period_average' as const,
      maxAverageDeviation: '0.05',
    };
    expect(usdOf(early, ctx(strict, MONTH))).toMatchObject({
      amount: null,
      reason: 'fx_average_not_representative',
    });
    const loose = { ...strict, maxAverageDeviation: null };
    const longer = { from: '2027-02-01T00:00:00Z', to: MONTH.to };
    expect(usdOf(early, ctx(loose, longer))).toMatchObject({
      amount: null,
      reason: 'fx_rate_missing',
    });
    expect(usdOf(early, ctx(loose))).toMatchObject({
      amount: null,
      reason: 'fx_rate_missing',
    });
  });
});

describe('V4 hourly cost of manual lines needs verified hours', () => {
  const window = { from: T0.getTime(), to: T0.getTime() + 12 * HOUR };
  const span = (fromHour: number, toHour: number) => ({
    from: T0.getTime() + fromHour * HOUR,
    to: T0.getTime() + toHour * HOUR,
  });

  it('a documented 2 h manual outage at $500/h is $1,000; an off-grade tonnage line gets no hourly view', () => {
    const hours = manualLineHours(
      [
        {
          id: 'outage',
          kind: 'availability',
          window,
          eventSpans: [span(1, 3)],
        },
        { id: 'offgrade', kind: 'quality', window, eventSpans: [span(1, 3)] },
      ],
      [],
    );
    expect(hours.has('offgrade')).toBe(false);
    const result = reconciledValuation({
      context: context(),
      candidates: [],
      lines: [
        {
          id: 'outage',
          sliceId: 's',
          kind: 'availability',
          quantity: new Dec(4),
          uom: 't',
          impactCodeId: STOP_CODE,
          hours: hours.get('outage'),
        },
      ],
      slices: [
        {
          sliceId: 's',
          profileId: PROFILE,
          productId: PRODUCT,
          start: T0,
          uom: 't',
        },
      ],
    });
    const hourly = result.lines[0].valuation.views.find(
      (v) => v.view === 'cost_per_hour',
    )!;
    expect(str(hourly.amounts[0].amount)).toBe('1000');
  });

  it('hours already charged by a kept automatic line or an earlier manual line are not charged twice', () => {
    const hours = manualLineHours(
      [
        { id: 'first', kind: 'availability', window, eventSpans: [span(1, 4)] },
        {
          id: 'second',
          kind: 'availability',
          window,
          eventSpans: [span(2, 4)],
        },
        { id: 'none', kind: 'availability', window, eventSpans: [] },
      ],
      [span(0, 2)],
    );
    expect(hours.get('first')).toEqual({ seconds: new Dec(7200) });
    expect(hours.get('second')).toEqual({ reason: 'hours_already_charged' });
    expect(hours.get('none')).toEqual({ reason: 'hours_unverified' });
  });
});

describe('V8 policy version 3 and snapshots', () => {
  it('the v3 body parses with the economic view as the default and equals the contracts default', () => {
    const parsed = parseValuationPolicy(VALUATION_POLICY_V3_BODY, {
      id: 'p',
      version: 3,
      approved: true,
    });
    expect(parsed.defaultBasis).toBe('economic_impact');
    expect(parsed.fx).toEqual({
      rateType: 'economic',
      dateRule: 'event_date',
      maxAverageDeviation: '0.05',
    });
    expect(parsed.economic?.demandRule).toBe('demand_constrained_only');
    const doc = JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          '../../../../contracts/policies/defaults/valuation_basis.v3.default.json',
        ),
        'utf8',
      ),
    ) as { body: unknown };
    expect(doc.body).toEqual(VALUATION_POLICY_V3_BODY);
  });

  it('refuses the economic default without economic rules, and bad dispositions', () => {
    const withoutRules = { ...VALUATION_POLICY_V3_BODY, demandRule: undefined };
    expect(() =>
      parseValuationPolicy(withoutRules, {
        id: null,
        version: null,
        approved: false,
      }),
    ).toThrow(ValuationPolicyError);
    expect(() =>
      parseValuationPolicy(
        {
          ...VALUATION_POLICY_V3_BODY,
          qualityDispositions: { [SCRAP_CODE]: 'landfill' },
        },
        { id: null, version: null, approved: false },
      ),
    ).toThrow(ValuationPolicyError);
  });

  it('a v2 body parses to the same snapshot as before (no v3 fields, run hashes unchanged)', () => {
    const v2 = parseValuationPolicy(
      {
        defaultBasis: 'contribution_margin',
        timeBasisRule: 'exclusive',
        reportingCurrencies: ['IRR', 'USD'],
        fxPolicy: 'snapshot',
      },
      { id: 'p2', version: 2, approved: true },
    );
    expect(Object.keys(v2).sort()).toEqual([
      'approved',
      'currencies',
      'defaultBasis',
      'fxPolicy',
      'id',
      'independentImpactCodeIds',
      'timeBasisRule',
      'version',
    ]);
  });

  it('the stored snapshot keeps components, demand status and notes of the economic view', () => {
    const ctx = context({ demand: [demand(false)] });
    const valued = valueLine(quality(SCRAP_CODE), ctx);
    const stored = storeLineValuation(valued, ctx.policy, ctx.engineVersion);
    const loaded = loadLineValuation(JSON.parse(JSON.stringify(stored)))!;
    const view = loaded.views.find((v) => v.view === 'economic_impact')!;
    expect(view.demandStatusId).toBe('demand-slack');
    expect(view.notes).toContain('demand_not_constrained');
    expect(view.components.map((c) => c.component)).toEqual([
      'variable_cost',
      'salvage',
    ]);
  });
});
