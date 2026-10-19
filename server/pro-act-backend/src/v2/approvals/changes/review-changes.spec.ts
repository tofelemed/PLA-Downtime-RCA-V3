import { addValueRows, deltaSides } from './review-changes';

describe('approval changes of a restatement (QA audit P-2)', () => {
  it('a value-only restatement shows the loss value of each side per currency, as money', () => {
    const sides = deltaSides({ totals: [], actuals: [], lines: [] });
    addValueRows(
      sides,
      {
        view: 'economic_impact',
        policyVersion: 1,
        amounts: [{ currency: 'USD', amount: '5040', status: 'valued' }],
      },
      {
        view: 'contribution_margin',
        policyVersion: 2,
        amounts: [{ currency: 'USD', amount: '5250', status: 'valued' }],
      },
    );
    expect(sides.before['value:USD']).toBe('5040');
    expect(sides.after['value:USD']).toBe('5250');
    expect(sides.specs).toEqual([
      expect.objectContaining({
        key: 'value:USD',
        label: 'Loss value (default valuation view)',
        format: 'money',
        group: 'value',
      }),
    ]);
    expect(sides.specs[0].currency?.({})).toBe('USD');
  });

  it('a revision without a predecessor shows its value on the after side only', () => {
    const sides = deltaSides({ totals: [], actuals: [], lines: [] });
    addValueRows(sides, undefined, {
      view: 'contribution_margin',
      policyVersion: 2,
      amounts: [{ currency: 'IRR', amount: '90', status: 'valued' }],
    });
    expect(sides.before['value:IRR']).toBeNull();
    expect(sides.after['value:IRR']).toBe('90');
  });
});
