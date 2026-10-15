import { Dec, formatDec } from '../../src/domain/actuals/decimal';
import { convert } from '../../src/domain/valuation/fx';
import { reconciledValuation } from '../../src/domain/valuation/reconciled-valuation';
import { valueLine } from '../../src/domain/valuation/value-line';
import {
  loadLineValuation,
  storeLineValuation,
} from '../../src/domain/valuation/valuation-snapshot';
import { valuationTotals } from '../../src/domain/valuation/valuation-totals';
import {
  FxRateSnapshot,
  ValuationContext,
  ValuationLineInput,
  ValuationPolicySnapshot,
} from '../../src/domain/valuation/valuation.types';

/**
 * SME V7 (14 Oct 2026) "an authorized provisional rate may support a clearly provisional financial view",
 * with the answer's own worked numbers (hypothetical rates, test data): an approved 50-tonne loss worth
 * 30 million IRR has no approved USD rate. Without any rate USD stays not valued; with a provisional rate
 * authorised by finance (600,000 IRR/USD) it shows $50 marked provisional with the rate id; once the final
 * rate is approved for that date the final one is used and the mark disappears. Never a guessed rate.
 */
const PROFILE = '11111111-1111-4111-8111-111111111111';
const T0 = new Date('2027-03-03T06:00:00Z');
const str = (value: Dec | null) => (value === null ? null : formatDec(value));

const fx = (
  id: string,
  rate: string,
  overrides: Partial<FxRateSnapshot> = {},
): FxRateSnapshot => ({
  id,
  version: 1,
  fromCurrency: 'USD',
  toCurrency: 'IRR',
  rate,
  from: '2027-03-01T00:00:00Z',
  to: '2027-04-01T00:00:00Z',
  ...overrides,
});

const PROVISIONAL = fx('fx-provisional', '600000', { provisional: true });
const FINAL = fx('fx-final', '600000', { version: 2 });

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

/** 50 t at 600,000 IRR/t contribution margin = 30 million IRR (V7 example). */
function context(
  rates: FxRateSnapshot[],
  overrides: Partial<ValuationContext> = {},
): ValuationContext {
  return {
    engineVersion: '2.6.0',
    policy: policy(),
    rates: [
      {
        id: 'margin',
        version: 1,
        ownerId: PROFILE,
        basis: 'contribution_margin',
        value: '600000',
        currency: 'IRR',
        perUom: 't',
        from: '2027-01-01T00:00:00Z',
        to: null,
      },
    ],
    fx: rates,
    ...overrides,
  };
}

const LOSS: ValuationLineInput = {
  kind: 'quality',
  quantity: new Dec(50),
  uom: 't',
  start: T0,
  end: T0,
  seconds: null,
  profileId: PROFILE,
  impactCodeId: null,
};

const usdOf = (ctx: ValuationContext) => {
  const margin = valueLine(LOSS, ctx).views[0];
  const usd = margin.amounts.find((a) => a.currency === 'USD');
  if (!usd) throw new Error('no USD amount');
  return usd;
};

describe('V7 provisional FX rates', () => {
  it('no approved rate: 50 t and 30 million IRR, USD not valued (never zero, never guessed)', () => {
    const view = valueLine(LOSS, context([])).views[0];
    expect(str(view.amounts[0].amount)).toBe('30000000');
    expect(view.amounts[1]).toMatchObject({
      currency: 'USD',
      amount: null,
      reason: 'fx_rate_missing',
    });
    expect(view.amounts[1].provisional).toBeUndefined();
  });

  it('an authorised provisional 600,000 IRR/USD gives $50, marked provisional with the rate id', () => {
    const usd = usdOf(context([PROVISIONAL]));
    expect(str(usd.amount)).toBe('50');
    expect(usd).toMatchObject({
      reason: null,
      fxRateIds: ['fx-provisional'],
      provisional: true,
    });
  });

  it('the final approved rate wins over a provisional one for the same date; the mark disappears', () => {
    const usd = usdOf(context([PROVISIONAL, fx('fx-final', '625000')]));
    expect(str(usd.amount)).toBe('48');
    expect(usd.fxRateIds).toEqual(['fx-final']);
    expect(usd.provisional).toBeUndefined();
  });

  it('native amounts never need a rate, so they are never provisional', () => {
    const view = valueLine(LOSS, context([PROVISIONAL])).views[0];
    expect(view.amounts[0].provisional).toBeUndefined();
  });

  it('the inverse pair converts provisionally too (exact division)', () => {
    const inverse = fx('fx-inverse', '0.000002', {
      fromCurrency: 'IRR',
      toCurrency: 'USD',
      provisional: true,
    });
    const converted = convert(new Dec(100), { from: 'USD', to: 'IRR' }, T0, {
      fx: [inverse],
      fxPolicy: 'snapshot',
    });
    expect(str(converted.amount)).toBe('50000000');
    expect(converted.provisional).toBe(true);
  });

  it('a month average with a provisional piece is provisional; a final-only month is not', () => {
    const month = { from: '2027-03-01T00:00:00Z', to: '2027-04-01T00:00:00Z' };
    const mid = '2027-03-16T12:00:00Z';
    const mixed = [
      fx('fx-a', '600000', { to: mid }),
      fx('fx-b', '750000', { from: mid, provisional: true }),
    ];
    const average = { average: month, fxPolicy: 'snapshot' as const };
    const pair = { from: 'USD', to: 'IRR' };
    const provisional = convert(new Dec(1), pair, T0, {
      ...average,
      fx: mixed,
    });
    expect(provisional.provisional).toBe(true);
    expect(provisional.fxRateIds).toEqual(['fx-a', 'fx-b']);
    const final = convert(new Dec(1), pair, T0, {
      ...average,
      fx: [FINAL],
    });
    expect(final.provisional).toBe(false);
  });

  it('totals count provisional lines and name the reason; the amount is still summed', () => {
    const valuation = valueLine(LOSS, context([PROVISIONAL]));
    const totals = valuationTotals(
      [
        {
          sliceId: 'slice',
          ledger: 'plan',
          kind: 'quality',
          uom: 't',
          quantity: LOSS.quantity,
          impactCodeId: null,
          valuation,
        },
      ],
      policy(),
    );
    const usd = totals.find(
      (t) => t.view === 'contribution_margin' && t.currency === 'USD',
    );
    const irr = totals.find(
      (t) => t.view === 'contribution_margin' && t.currency === 'IRR',
    );
    expect(usd).toMatchObject({
      status: 'valued',
      fxProvisionalLines: 1,
      reasons: ['fx_rate_provisional'],
    });
    expect(str(usd?.amount ?? null)).toBe('50');
    expect(irr).toMatchObject({ fxProvisionalLines: 0, reasons: [] });
  });

  it('the stored snapshot keeps the mark; older snapshots (no field) load as final, shape unchanged', () => {
    const provisional = storeLineValuation(
      valueLine(LOSS, context([PROVISIONAL])),
      policy(),
      '2.6.0',
    );
    expect(provisional.views[0].amounts[1]).toMatchObject({
      provisional: true,
    });
    expect(
      loadLineValuation(provisional)?.views[0].amounts[1].provisional,
    ).toBe(true);
    const final = storeLineValuation(
      valueLine(LOSS, context([FINAL])),
      policy(),
      '2.6.0',
    );
    expect(Object.keys(final.views[0].amounts[1])).not.toContain('provisional');
  });

  it('a decided candidate keeps the provisional mark when scaled to its decided quantity', () => {
    const result = reconciledValuation({
      context: context([PROVISIONAL]),
      candidates: [
        {
          lossLineId: 'line-1',
          sliceId: 'slice',
          kind: 'quality',
          quantity: new Dec(50),
          effectiveQuantity: new Dec(25),
          state: 'accepted',
          impactCodeId: null,
          valuation: valueLine(LOSS, context([PROVISIONAL])),
        },
      ],
      lines: [],
      slices: [{ sliceId: 'slice', profileId: PROFILE, start: T0, uom: 't' }],
    });
    const usd = result.lines[0].valuation.views[0].amounts[1];
    expect(str(usd.amount)).toBe('25');
    expect(usd.provisional).toBe(true);
    expect(result.slices[0]).toBeDefined();
  });
});
