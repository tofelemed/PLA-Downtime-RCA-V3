import * as fs from 'fs';
import * as path from 'path';
import { Dec, formatDec } from '../../src/domain/actuals/decimal';
import { reconciledValuation } from '../../src/domain/valuation/reconciled-valuation';
import { valueLine } from '../../src/domain/valuation/value-line';
import {
  storeLineValuation,
  loadLineValuation,
} from '../../src/domain/valuation/valuation-snapshot';
import {
  TotalsLine,
  valuationTotals,
} from '../../src/domain/valuation/valuation-totals';
import {
  FxRateSnapshot,
  ValuationContext,
  ValuationLineInput,
  ValuationPolicySnapshot,
  ValuationRateSnapshot,
} from '../../src/domain/valuation/valuation.types';

/**
 * Plan 2.6 through the pure valuation domain: T38 (missing price), T45 (two currencies with and without an
 * approved FX rate), VAL02 exclusivity of views and the `independent_components` rule, effective-dated
 * rates split inside a line, 8-dp storage, the unapproved-policy rule and the reconciled (2.8) valuation.
 * Persisted versions run in `valuation.int-spec.ts`.
 */
const fixture = (id: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, `${id}.json`), 'utf8')) as {
    id: string;
    owner_subphase: string;
  };

const PROFILE = '11111111-1111-4111-8111-111111111111';
const IMPACT = '22222222-2222-4222-8222-222222222222';
const OTHER_IMPACT = '33333333-3333-4333-8333-333333333333';
const T10 = new Date('2027-03-01T06:30:00Z');
const at = (minutes: number) => new Date(T10.getTime() + minutes * 60_000);
const str = (value: Dec | null) => (value === null ? null : formatDec(value));

function policy(
  overrides: Partial<ValuationPolicySnapshot> = {},
): ValuationPolicySnapshot {
  return {
    id: 'policy-2',
    version: 2,
    approved: true,
    defaultBasis: 'contribution_margin',
    timeBasisRule: 'exclusive',
    currencies: ['IRR', 'USD'],
    fxPolicy: 'snapshot',
    independentImpactCodeIds: [],
    ...overrides,
  };
}

function rate(
  id: string,
  basis: ValuationRateSnapshot['basis'],
  value: string,
  overrides: Partial<ValuationRateSnapshot> = {},
): ValuationRateSnapshot {
  return {
    id,
    version: 1,
    ownerId: basis === 'cost_per_hour' ? IMPACT : PROFILE,
    basis,
    value,
    currency: 'IRR',
    perUom: basis === 'cost_per_hour' ? 'h' : 't',
    from: '2027-01-01T00:00:00Z',
    to: null,
    ...overrides,
  };
}

const FX: FxRateSnapshot = {
  id: 'fx-1',
  version: 1,
  fromCurrency: 'USD',
  toCurrency: 'IRR',
  rate: '500000',
  from: '2027-01-01T00:00:00Z',
  to: null,
};

function context(
  rates: ValuationRateSnapshot[],
  fx: FxRateSnapshot[] = [],
  overrides: Partial<ValuationPolicySnapshot> = {},
): ValuationContext {
  return { engineVersion: '2.6.0', policy: policy(overrides), rates, fx };
}

function line(overrides: Partial<ValuationLineInput> = {}): ValuationLineInput {
  return {
    kind: 'availability',
    quantity: new Dec(25),
    uom: 't',
    start: at(0),
    end: at(60),
    seconds: null,
    profileId: PROFILE,
    impactCodeId: null,
    ...overrides,
  };
}

function totalsLine(
  input: ValuationLineInput,
  ctx: ValuationContext,
  overrides: Partial<TotalsLine> = {},
): TotalsLine {
  return {
    sliceId: 'slice-1',
    ledger: 'capacity',
    kind: input.kind,
    uom: input.uom,
    quantity: input.quantity,
    impactCodeId: input.impactCodeId,
    valuation: valueLine(input, ctx),
    ...overrides,
  };
}

describe('valuation (plan 2.6, VAL01–VAL03)', () => {
  it('T38 missing price: quantity remains, amount null and unvalued, totals show the unvalued quantity', () => {
    expect(fixture('T38').owner_subphase).toBe('2.6');
    const ctx = context([]);
    const valued = valueLine(line(), ctx);
    const margin = valued.views.find((v) => v.view === 'contribution_margin')!;
    expect(margin).toMatchObject({
      status: 'unvalued',
      reason: 'rate_missing',
    });
    expect(margin.amounts.map((a) => a.amount)).toEqual([null, null]);
    const [irr] = valuationTotals([totalsLine(line(), ctx)], ctx.policy).filter(
      (t) => t.view === 'contribution_margin' && t.currency === 'IRR',
    );
    expect(irr.amount).toBeNull();
    expect(irr.status).toBe('unvalued');
    expect(str(irr.unvaluedQuantity)).toBe('25');
    expect(irr.reasons).toEqual(['rate_missing']);
  });

  it('T45 two currencies: without FX separate native totals and no combined total; with FX combined and the FX version recorded', () => {
    expect(fixture('T45').owner_subphase).toBe('2.6');
    const rates = [
      rate('m-irr', 'contribution_margin', '1000000'),
      rate('m-usd', 'contribution_margin', '2', {
        ownerId: 'profile-usd',
        currency: 'USD',
      }),
    ];
    const lines = (ctx: ValuationContext) => [
      totalsLine(line({ quantity: new Dec(10) }), ctx),
      totalsLine(line({ quantity: new Dec(5), profileId: 'profile-usd' }), ctx),
    ];
    const pick = (ctx: ValuationContext, currency: string) =>
      valuationTotals(lines(ctx), ctx.policy).find(
        (t) => t.view === 'contribution_margin' && t.currency === currency,
      )!;
    const noFx = context(rates);
    expect(pick(noFx, 'IRR')).toMatchObject({
      amount: null,
      fxMissingLines: 1,
      reasons: ['fx_rate_missing'],
      status: 'mixed',
    });
    expect(str(pick(noFx, 'IRR').nativeAmount)).toBe('10000000');
    expect(str(pick(noFx, 'USD').nativeAmount)).toBe('10');
    expect(pick(noFx, 'USD').amount).toBeNull();
    const withFx = context(rates, [FX]);
    expect(str(pick(withFx, 'IRR').amount)).toBe('15000000');
    expect(pick(withFx, 'IRR').fxRateIds).toEqual(['fx-1']);
    // the inverse pair divides: 10 000 000 IRR / 500 000 = 20 USD, + 10 USD
    expect(str(pick(withFx, 'USD').amount)).toBe('30');
    expect(pick(withFx, 'USD').status).toBe('valued');
  });

  it('VAL02: margin and time cost are separate views, never summed (2 500 and 1 200, not 3 700)', () => {
    const rates = [
      rate('m', 'contribution_margin', '100'),
      rate('c', 'cost_per_hour', '1200'),
    ];
    const input = line({ seconds: new Dec(3600), impactCodeId: IMPACT });
    const ctx = context(rates);
    const totals = valuationTotals([totalsLine(input, ctx)], ctx.policy).filter(
      (t) => t.currency === 'IRR',
    );
    const byView = Object.fromEntries(
      totals.map((t) => [t.view, str(t.amount)]),
    );
    expect(byView).toEqual({
      contribution_margin: '2500',
      cost_per_hour: '1200',
      standard_cost: null,
    });
    expect(totals.some((t) => str(t.amount) === '3700')).toBe(false);
  });

  it('VAL02 independent_components: summation only for the impact codes the policy names', () => {
    const rates = [
      rate('m', 'contribution_margin', '100'),
      rate('c', 'cost_per_hour', '1200'),
      rate('c2', 'cost_per_hour', '600', { ownerId: OTHER_IMPACT }),
    ];
    const ctx = context(rates, [], {
      timeBasisRule: 'independent_components',
      independentImpactCodeIds: [IMPACT],
    });
    const independent = line({ seconds: new Dec(3600), impactCodeId: IMPACT });
    const other = line({ seconds: new Dec(3600), impactCodeId: OTHER_IMPACT });
    const totals = valuationTotals(
      [
        totalsLine(independent, ctx),
        totalsLine(other, ctx, { sliceId: 'slice-2' }),
      ],
      ctx.policy,
    ).filter(
      (t) => t.view === 'independent_components' && t.currency === 'IRR',
    );
    expect(totals).toHaveLength(1);
    expect(totals[0].sliceId).toBe('slice-1');
    expect(str(totals[0].amount)).toBe('3700');
  });

  it('effective dating: a rate change at 10:30 values 10:00–10:30 with v1 and 10:30–11:00 with v2', () => {
    const rates = [
      rate('v1', 'contribution_margin', '100', { to: at(30).toISOString() }),
      rate('v2', 'contribution_margin', '120', {
        version: 2,
        from: at(30).toISOString(),
      }),
    ];
    const ctx = context(rates);
    const margin = valueLine(line({ quantity: new Dec(50) }), ctx).views[0];
    expect(
      margin.components.map((c) => [
        c.rateVersionId,
        str(c.quantity),
        str(c.amount),
      ]),
    ).toEqual([
      ['v1', '25', '2500'],
      ['v2', '25', '3000'],
    ]);
    const second = valueLine(
      line({ start: at(30), end: at(60), quantity: new Dec(25) }),
      ctx,
    ).views[0];
    expect(second.components.map((c) => c.rateVersionId)).toEqual(['v2']);
    // a quality line (not time-uniform) takes the rate in force at its valuation date
    const quality = valueLine(
      line({ kind: 'quality', quantity: new Dec(50) }),
      ctx,
    );
    expect(quality.views[0].components.map((c) => c.rateVersionId)).toEqual([
      'v1',
    ]);
  });

  it('a gap in the rate history leaves the whole line unvalued (no partial value)', () => {
    const ctx = context([
      rate('v1', 'contribution_margin', '100', { to: at(30).toISOString() }),
    ]);
    expect(valueLine(line(), ctx).views[0]).toMatchObject({
      status: 'unvalued',
      reason: 'rate_missing',
    });
  });

  it('stores 8 decimals and rounds nothing else; snapshots round-trip', () => {
    const ctx = context([rate('m', 'contribution_margin', '12.3456789')]);
    const valued = valueLine(line({ quantity: new Dec('100.000000005') }), ctx);
    const stored = storeLineValuation(valued, ctx.policy, '2.6.0');
    expect(stored.views[0].amounts[0].amount).toBe('1234.56789006');
    expect(stored.roundingPolicy).toBe('stored_8dp_presentation_minor_units');
    expect(
      loadLineValuation(JSON.parse(JSON.stringify(stored)))?.views[0].status,
    ).toBe('valued');
  });

  it('no valuation before policy approval, and the XXX placeholder never values', () => {
    const rates = [rate('m', 'contribution_margin', '100')];
    const unapproved = valueLine(
      line(),
      context(rates, [], { approved: false }),
    );
    expect(unapproved.views.map((v) => v.reason)).toEqual([
      'policy_unapproved',
      'policy_unapproved',
    ]);
  });

  it('units are never converted: a rate per kg does not value a line in t', () => {
    const ctx = context([
      rate('m', 'contribution_margin', '1', { perUom: 'kg' }),
    ]);
    expect(valueLine(line(), ctx).views[0].reason).toBe('uom_mismatch');
  });

  it('gains and residuals are valued but kept apart from losses', () => {
    const ctx = context([rate('m', 'contribution_margin', '100')]);
    const totals = valuationTotals(
      [
        totalsLine(line(), ctx),
        totalsLine(line({ kind: 'gain', quantity: new Dec(-5) }), ctx),
      ],
      ctx.policy,
    ).filter((t) => t.view === 'contribution_margin' && t.currency === 'IRR');
    expect(totals.map((t) => [t.kind, str(t.amount)]).sort()).toEqual([
      ['availability', '2500'],
      ['gain', '-500'],
    ]);
  });

  it('reconciled valuation: decided candidates scale, manual lines are valued from the frozen context', () => {
    const ctx = context([rate('m', 'contribution_margin', '100')], [FX]);
    const candidate = valueLine(line(), ctx);
    const result = reconciledValuation({
      context: ctx,
      candidates: [
        {
          lossLineId: 'c1',
          sliceId: 'slice-1',
          kind: 'availability',
          quantity: new Dec(25),
          effectiveQuantity: new Dec(20),
          state: 'adjusted',
          impactCodeId: null,
          valuation: candidate,
        },
      ],
      lines: [
        {
          id: 'm1',
          sliceId: 'slice-1',
          kind: 'quality',
          quantity: new Dec(3),
          uom: null,
          impactCodeId: null,
        },
      ],
      slices: [
        { sliceId: 'slice-1', profileId: PROFILE, start: at(0), uom: 't' },
      ],
    });
    const irr = result.slices.find(
      (s) => s.view === 'contribution_margin' && s.currency === 'IRR',
    )!;
    expect(str(irr.amount)).toBe('2300');
    const usd = result.slices.find(
      (s) => s.view === 'contribution_margin' && s.currency === 'USD',
    )!;
    expect(str(usd.amount)).toBe('0.0046');
    const byKind = (kind: string) =>
      result.totals.find(
        (t) =>
          t.kind === kind &&
          t.view === 'contribution_margin' &&
          t.currency === 'IRR',
      );
    expect(result.totals.every((t) => t.ledger === 'plan')).toBe(true);
    expect(str(byKind('availability')!.amount)).toBe('2000');
    expect(str(byKind('quality')!.amount)).toBe('300');
  });
});
