import { Dec, formatDec } from '../../src/domain/actuals/decimal';
import { reconciledValuation } from '../../src/domain/valuation/reconciled-valuation';
import {
  REVERSAL_NOTE,
  REVERSED_CURRENCY_MISSING,
  REVERSED_LINE_UNVALUED,
  ReversedLineValue,
  valuesReversalsAtApprovedValue,
} from '../../src/domain/valuation/reversal-valuation';
import {
  ValuationContext,
  ValuationView,
} from '../../src/domain/valuation/valuation.types';

/**
 * SME R9 reversal valuation (valuation 2.8.1): an approved 10 t availability line of 1 Mar was valued at
 * 1,000,000 IRR/t contribution margin = 10,000,000,000 IRR and 20,000 USD at that day's FX, standard cost
 * 6,000,000,000 IRR / 12,000 USD. On 3 Mar the rates and FX changed (2,000,000 IRR/t, a new FX), and 4 t of
 * the line are found erroneous: the reversal carries −4 / 10 of the **approved** value on each view and
 * currency (−4,000,000,000 IRR, −8,000 USD margin), never the 3 Mar rates.
 */
const PROFILE = '11111111-1111-4111-8111-111111111111';
const MAR1 = new Date('2027-03-01T02:30:00Z');
const MAR3 = new Date('2027-03-03T02:30:00Z');
const str = (value: Dec | null) => (value === null ? null : formatDec(value));

function context(engineVersion = '2.8.1'): ValuationContext {
  return {
    engineVersion,
    policy: {
      id: 'policy-2',
      version: 2,
      approved: true,
      defaultBasis: 'contribution_margin',
      timeBasisRule: 'exclusive',
      currencies: ['IRR', 'USD'],
      fxPolicy: 'snapshot',
      independentImpactCodeIds: [],
    },
    rates: [
      {
        id: 'margin-mar3',
        version: 2,
        ownerId: PROFILE,
        basis: 'contribution_margin',
        value: '2000000',
        currency: 'IRR',
        perUom: 't',
        from: '2027-03-02T00:00:00Z',
        to: null,
      },
    ],
    fx: [
      {
        id: 'fx-mar3',
        version: 1,
        fromCurrency: 'USD',
        toCurrency: 'IRR',
        rate: '1000000',
        from: '2027-03-02T00:00:00Z',
        to: null,
      },
    ],
  };
}

const cell = (
  view: ValuationView,
  currency: string,
  amount: string | null,
  status = 'valued',
  reason: string | null = null,
) => ({
  view,
  currency,
  amount: amount === null ? null : new Dec(amount),
  status,
  reason,
});

const APPROVED: ReversedLineValue = {
  quantity: new Dec(10),
  valuationDate: MAR1,
  cells: [
    cell('contribution_margin', 'IRR', '10000000000'),
    cell('contribution_margin', 'USD', '20000'),
    cell('standard_cost', 'IRR', '6000000000'),
    cell('standard_cost', 'USD', '12000'),
  ],
};

function value(
  reversed: ReversedLineValue | null,
  quantity = '-4',
  engineVersion = '2.8.1',
) {
  return reconciledValuation({
    context: context(engineVersion),
    candidates: [],
    lines: [
      {
        id: 'rev-1',
        sliceId: 'slice-mar3',
        kind: 'reversal',
        quantity: new Dec(quantity),
        uom: 't',
        impactCodeId: null,
        reversed,
      },
    ],
    slices: [
      { sliceId: 'slice-mar3', profileId: PROFILE, start: MAR3, uom: 't' },
    ],
  });
}

const amounts = (result: ReturnType<typeof value>, view: ValuationView) =>
  result.lines[0].valuation.views
    .find((v) => v.view === view)
    ?.amounts.map((a) => [a.currency, str(a.amount), a.reason]);

describe('reversal valuation at the approved value (SME R9, valuation 2.8.1)', () => {
  it('a partial reversal carries −4/10 of the approved value on every view and currency, never today’s rates', () => {
    const result = value(APPROVED);
    expect(amounts(result, 'contribution_margin')).toEqual([
      ['IRR', '-4000000000', null],
      ['USD', '-8000', null],
    ]);
    expect(amounts(result, 'standard_cost')).toEqual([
      ['IRR', '-2400000000', null],
      ['USD', '-4800', null],
    ]);
    const margin = result.lines[0].valuation.views[0];
    expect(margin.notes).toEqual([REVERSAL_NOTE]);
    expect(margin.components).toEqual([]);
    expect(result.lines[0].valuation.valuationDate).toEqual(MAR1);
  });

  it('a full reversal carries the whole approved value with the opposite sign; the memo kind stays out of the slice loss value', () => {
    const result = value(APPROVED, '-10');
    expect(amounts(result, 'contribution_margin')).toEqual([
      ['IRR', '-10000000000', null],
      ['USD', '-20000', null],
    ]);
    const total = result.totals.find(
      (t) =>
        t.kind === 'reversal' &&
        t.view === 'contribution_margin' &&
        t.currency === 'USD',
    );
    expect(str(total?.amount ?? null)).toBe('-20000');
    expect(result.slices).toEqual([]);
  });

  it('an original not valued in a currency, or not valued at all, keeps the reversal unvalued there', () => {
    const usdMissing = value({
      ...APPROVED,
      cells: [
        cell('contribution_margin', 'IRR', '10000000000'),
        cell('contribution_margin', 'USD', null, 'valued', 'fx_rate_missing'),
      ],
    });
    expect(amounts(usdMissing, 'contribution_margin')).toEqual([
      ['IRR', '-4000000000', null],
      ['USD', null, 'fx_rate_missing'],
    ]);
    const eurOnly = value({
      ...APPROVED,
      cells: [cell('contribution_margin', 'EUR', '100')],
    });
    expect(amounts(eurOnly, 'contribution_margin')).toEqual([
      ['IRR', null, REVERSED_CURRENCY_MISSING],
      ['USD', null, REVERSED_CURRENCY_MISSING],
    ]);
    const unvalued = value({
      ...APPROVED,
      cells: [
        cell('contribution_margin', 'IRR', null, 'unvalued', 'rate_missing'),
      ],
    });
    expect(unvalued.lines[0].valuation.views[0]).toMatchObject({
      status: 'unvalued',
      reason: 'rate_missing',
    });
  });

  it('a reversed line without a stored approved valuation is unvalued on the policy views', () => {
    const result = value(null);
    expect(result.lines[0].valuation.views.map((v) => v.view)).toEqual([
      'contribution_margin',
      'standard_cost',
    ]);
    expect(
      result.lines[0].valuation.views.every(
        (v) => v.status === 'unvalued' && v.reason === REVERSED_LINE_UNVALUED,
      ),
    ).toBe(true);
  });

  it('runs frozen before 2.8.1 keep the rule they were calculated with (priced from their own context)', () => {
    expect(valuesReversalsAtApprovedValue('2.8.0')).toBe(false);
    expect(valuesReversalsAtApprovedValue('2.8.1')).toBe(true);
    expect(valuesReversalsAtApprovedValue('2.10.0')).toBe(true);
    expect(valuesReversalsAtApprovedValue('3.0.0')).toBe(true);
    const old = value(APPROVED, '-4', '2.8.0');
    expect(old.lines[0].valuation.views[0].notes).toBeUndefined();
    expect(amounts(old, 'contribution_margin')?.[0]).toEqual([
      'IRR',
      '-8000000',
      null,
    ]);
  });
});
