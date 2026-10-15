import { Dec, formatDec } from '../../src/domain/actuals/decimal';
import { ValuationBasis } from '../../src/domain/profiles/profile.types';
import { componentAmounts } from '../../src/domain/valuation/component-amounts';
import { valueLine } from '../../src/domain/valuation/value-line';
import {
  loadLineValuation,
  storeLineValuation,
} from '../../src/domain/valuation/valuation-snapshot';
import {
  DemandStatusSnapshot,
  LineViewValuation,
  ReworkLotSnapshot,
  ReworkRecoverySnapshot,
  VALUATION_ENGINE_VERSION,
  ValuationContext,
  ValuationLineInput,
  ValuationRateSnapshot,
} from '../../src/domain/valuation/valuation.types';

/**
 * SME V2 remainder (engine 2.8.0) with a worked example, illustrative magnitudes (not plant data): price
 * $1,000/t, avoidable variable cost $700/t, contribution $300/t, salvage $50/t, disposal $20/t, rework
 * $60/t; approved rework yield 0.9; the unit's planned rate 5 t/h; 10 t of a sold-out product reworked.
 *
 *   rework cost        10 t × $60                       =   $600
 *   yield loss          1 t × ($300 + $700 − $50 + $20)  =   $970   (10 t × (1 − 0.9) not recovered)
 *   displaced output   10 t × $300                      = $3,000   (2 h of rework at 5 t/h, sold out)
 *   economic impact                                     = $4,570
 *
 * With the recovery recorded (8.5 t back after 1.5 h of reprocessing on the same unit) the record wins
 * over the yield: 1.5 t lost ($1,455) and 1.5 h × 5 t/h = 7.5 t displaced ($2,250): $600 + $1,455 + $2,250
 * = $4,305.
 */
const PROFILE = '11111111-1111-4111-8111-111111111111';
const PRODUCT = '44444444-4444-4444-8444-444444444444';
const T0 = new Date('2027-03-03T06:00:00Z');
const HOUR = 3_600_000;
const iso = (hours: number) =>
  new Date(T0.getTime() + hours * HOUR).toISOString();
const str = (value: Dec | null) => (value === null ? null : formatDec(value));

const rate = (basis: ValuationBasis, value: string): ValuationRateSnapshot => ({
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

const RATES = [
  rate('contribution_margin', '300'),
  rate('variable_cost', '700'),
  rate('salvage_value', '50'),
  rate('disposal_cost', '20'),
  rate('rework_cost', '60'),
];

const demand = (constrained: boolean): DemandStatusSnapshot => ({
  id: constrained ? 'demand-sold-out' : 'demand-slack',
  version: 1,
  productId: PRODUCT,
  constrained,
  from: '2027-03-01T00:00:00Z',
  to: '2027-04-01T00:00:00Z',
});

const YIELD = {
  id: 'yield-90',
  version: 1,
  profileId: PROFILE,
  value: '0.9',
  from: '2027-01-01T00:00:00Z',
  to: null,
};

const PLANNED = {
  id: 'planning-5',
  version: 1,
  profileId: PROFILE,
  rate: '5',
  timebase: 'h' as const,
  from: '2027-01-01T00:00:00Z',
  to: null,
};

const recovery = (
  overrides: Partial<ReworkRecoverySnapshot> = {},
): ReworkRecoverySnapshot => ({
  id: 'recovery-1',
  start: iso(24),
  end: iso(25.5),
  quantity: '8.5',
  remeasured: false,
  sameUnit: true,
  ...overrides,
});

const lot = (
  recoveries: ReworkRecoverySnapshot[],
  quantity = '10',
): ReworkLotSnapshot => ({
  id: 'lot-rework',
  productId: PRODUCT,
  start: iso(0),
  end: iso(8),
  quantity,
  uom: 't',
  recoveries,
});

function context(overrides: Partial<ValuationContext> = {}): ValuationContext {
  return {
    engineVersion: VALUATION_ENGINE_VERSION,
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
      economic: {
        demandRule: 'demand_constrained_only',
        qualityDispositions: {},
        defaultQualityDisposition: null,
        manualLineHours: false,
      },
    },
    rates: RATES,
    fx: [],
    demand: [demand(true)],
    reworkYields: [YIELD],
    plannedRates: [PLANNED],
    ...overrides,
  };
}

/** A rework-class quality line of 10 t at the valuation date T0 (inside the lot's production interval). */
const REWORK: ValuationLineInput = {
  kind: 'quality',
  quantity: new Dec(10),
  uom: 't',
  start: T0,
  end: T0,
  seconds: null,
  profileId: PROFILE,
  impactCodeId: null,
  productId: PRODUCT,
  qualityClass: 'rework',
};

function economic(ctx: ValuationContext, line = REWORK): LineViewValuation {
  const found = valueLine(line, ctx).views.find(
    (v) => v.view === 'economic_impact',
  );
  if (!found) throw new Error('no economic view');
  return found;
}

const usd = (view: LineViewValuation) => str(view.amounts[0].amount);
const parts = (view: LineViewValuation) =>
  view.components.map((c) => [c.component, str(c.quantity), str(c.amount)]);

describe('SME V2 yield loss on rework (engine 2.8.0)', () => {
  it('engine version is 2.8.0', () => {
    expect(VALUATION_ENGINE_VERSION).toBe('2.8.0');
  });

  it('no recovery recorded: the approved 0.9 yield loses 1 t valued like scrap; rework time displaces 10 t: $4,570', () => {
    const view = economic(context());
    expect(parts(view)).toEqual([
      ['rework_cost', '10', '600'],
      ['yield_loss_contribution', '1', '300'],
      ['yield_loss_variable_cost', '1', '700'],
      ['yield_loss_salvage', '1', '-50'],
      ['yield_loss_disposal', '1', '20'],
      ['displaced_contribution', '10', '3000'],
    ]);
    expect(usd(view)).toBe('4570');
    expect(view.notes).toEqual([
      'disposition_rework',
      'rework_yield_rate',
      'rework_time_estimated',
    ]);
    expect(view.demandStatusId).toBe('demand-sold-out');
  });

  it('recovery recorded: 8.5 t back after 1.5 h → 1.5 t lost ($1,455), 7.5 t displaced ($2,250): $4,305', () => {
    const view = economic(context({ reworkLots: [lot([recovery()])] }));
    expect(parts(view)).toEqual([
      ['rework_cost', '10', '600'],
      ['yield_loss_contribution', '1.5', '450'],
      ['yield_loss_variable_cost', '1.5', '1050'],
      ['yield_loss_salvage', '1.5', '-75'],
      ['yield_loss_disposal', '1.5', '30'],
      ['displaced_contribution', '7.5', '2250'],
    ]);
    expect(usd(view)).toBe('4305');
    expect(view.notes).toEqual([
      'disposition_rework',
      'rework_recovery_recorded',
    ]);
  });

  it('reprocessing measured again at the boundary is lost output of its own ledger: no displaced part ($2,055)', () => {
    const view = economic(
      context({ reworkLots: [lot([recovery({ remeasured: true })])] }),
    );
    expect(usd(view)).toBe('2055');
    expect(view.notes).toContain('displaced_output_in_ledger');
    expect(view.components.map((c) => c.component)).not.toContain(
      'displaced_contribution',
    );
  });

  it('reprocessing on another unit does not use this unit capacity', () => {
    const view = economic(
      context({ reworkLots: [lot([recovery({ sameUnit: false })])] }),
    );
    expect(usd(view)).toBe('2055');
    expect(view.notes).toContain('displaced_rework_other_unit');
  });

  it('spare capacity (not sold out): no lost contribution, no displaced output — 1 t × ($700 − $50 + $20) + $600 = $1,270', () => {
    const view = economic(context({ demand: [demand(false)] }));
    expect(usd(view)).toBe('1270');
    expect(view.notes).toEqual([
      'disposition_rework',
      'rework_yield_rate',
      'displaced_not_constrained',
      'demand_not_constrained',
    ]);
  });

  it('part recorded, part not: 4 t fully recovered in 0.5 h, 6 t at the 0.9 yield → $600 + $582 + $2,550 = $3,732', () => {
    const view = economic(
      context({
        reworkLots: [lot([recovery({ quantity: '4', end: iso(24.5) })], '4')],
      }),
    );
    expect(parts(view)).toEqual([
      ['rework_cost', '10', '600'],
      ['yield_loss_contribution', '0.6', '180'],
      ['yield_loss_variable_cost', '0.6', '420'],
      ['yield_loss_salvage', '0.6', '-30'],
      ['yield_loss_disposal', '0.6', '12'],
      ['displaced_contribution', '8.5', '2550'],
    ]);
    expect(usd(view)).toBe('3732');
  });

  it('a lot holding more than the line is scaled to the line: 20 t lot, 17 t recovered, 10 t line → 1.5 t lost', () => {
    const view = economic(
      context({
        reworkLots: [lot([recovery({ quantity: '17', end: iso(27) })], '20')],
      }),
    );
    const lost = view.components.find(
      (c) => c.component === 'yield_loss_variable_cost',
    );
    expect(str(lost?.quantity ?? null)).toBe('1.5');
    // 3 h × 5 t/h × (10 / 20) = 7.5 t displaced
    const displaced = view.components.find(
      (c) => c.component === 'displaced_contribution',
    );
    expect(str(displaced?.quantity ?? null)).toBe('7.5');
  });

  it('no yield rate and no recovery: the yield loss stays out with a note, never guessed', () => {
    const view = economic(context({ reworkYields: [] }));
    expect(usd(view)).toBe('3600');
    expect(view.notes).toContain('no_rework_yield_rate');
  });

  it('a required value missing leaves the view unvalued (never zero)', () => {
    const noCost = context({
      rates: RATES.filter((r) => r.basis !== 'variable_cost'),
    });
    expect(economic(noCost)).toMatchObject({
      status: 'unvalued',
      reason: 'variable_cost_missing',
    });
    const fullYield = context({
      rates: RATES.filter((r) => r.basis !== 'variable_cost'),
      reworkYields: [{ ...YIELD, value: '1' }],
    });
    expect(usd(economic(fullYield))).toBe('3600');
    const noPlan = context({
      plannedRates: [],
      reworkLots: [lot([recovery()])],
    });
    expect(economic(noPlan)).toMatchObject({
      status: 'unvalued',
      reason: 'planned_rate_missing',
    });
    expect(economic(context({ demand: [] }))).toMatchObject({
      status: 'unvalued',
      reason: 'demand_status_missing',
    });
  });

  it('the all-lost-output rule charges displaced output without a demand status', () => {
    const base = context({ demand: [] });
    const always = {
      ...base,
      policy: {
        ...base.policy,
        economic: {
          ...base.policy.economic!,
          demandRule: 'all_lost_output' as const,
        },
      },
    };
    expect(usd(economic(always))).toBe('4570');
  });

  it('the stored snapshot keeps every component name (old runs keep their own components)', () => {
    const ctx = context();
    const valuation = valueLine(REWORK, ctx);
    const stored = storeLineValuation(valuation, ctx.policy, ctx.engineVersion);
    expect(stored.engineVersion).toBe('2.8.0');
    const loaded = loadLineValuation(stored);
    const view = loaded?.views.find((v) => v.view === 'economic_impact');
    expect(view?.components.map((c) => c.component)).toContain(
      'displaced_contribution',
    );
    expect(view?.components.map((c) => c.component)).toContain(
      'yield_loss_salvage',
    );
  });
});

describe('VA-04 stored component amounts (the parts add up to the line)', () => {
  it('per reporting currency: $600 + $300 + $700 − $50 + $20 + $3,000 = $4,570; IRR at 600,000 IRR/USD', () => {
    const ctx = context({
      policy: { ...context().policy, currencies: ['IRR', 'USD'] },
      fx: [
        {
          id: 'fx-600',
          version: 1,
          fromCurrency: 'USD',
          toCurrency: 'IRR',
          rate: '600000',
          from: '2027-03-01T00:00:00Z',
          to: null,
          provisional: true,
        },
      ],
    });
    const view = economic(ctx);
    const usdParts = componentAmounts(view, 'USD', ctx);
    expect(usdParts?.map((p) => [p.component, p.amount, p.quantity])).toEqual([
      ['rework_cost', '600', '10'],
      ['yield_loss_contribution', '300', '1'],
      ['yield_loss_variable_cost', '700', '1'],
      ['yield_loss_salvage', '-50', '1'],
      ['yield_loss_disposal', '20', '1'],
      ['displaced_contribution', '3000', '10'],
    ]);
    const total = (usdParts ?? []).reduce(
      (s, p) => s.plus(p.amount ?? 0),
      new Dec(0),
    );
    const line = view.amounts.find((a) => a.currency === 'USD');
    expect(str(total)).toBe(str(line?.amount ?? null));
    expect(str(total)).toBe('4570');
    const irr = componentAmounts(view, 'IRR', ctx);
    expect(irr?.[0]).toEqual({
      component: 'rework_cost',
      amount: '360000000',
      quantity: '10',
      provisional: true,
    });
  });

  it('no FX rate → null amounts; other views and unvalued lines have no parts', () => {
    const ctx = context({
      policy: { ...context().policy, currencies: ['IRR', 'USD'] },
    });
    const view = economic(ctx);
    expect(
      componentAmounts(view, 'IRR', ctx)?.every((p) => p.amount === null),
    ).toBe(true);
    const margin = valueLine(REWORK, ctx).views.find(
      (v) => v.view === 'contribution_margin',
    );
    expect(margin && componentAmounts(margin, 'USD', ctx)).toBeNull();
    const unvalued = economic(context({ demand: [] }));
    expect(componentAmounts(unvalued, 'USD', ctx)).toBeNull();
  });
});
