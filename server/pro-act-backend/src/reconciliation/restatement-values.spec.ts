import { restatementValues } from './restatement-values';

describe('restatementValues (QA audit P-2: a value-only restatement shows its value change)', () => {
  it('Marun shift A: economic impact 5,040 USD → contribution margin 5,250 USD, quantities unchanged', () => {
    const values = restatementValues(
      {
        view: 'economic_impact',
        policyVersion: 1,
        amounts: [
          { currency: 'USD', amount: '5040', status: 'valued' },
          { currency: 'IRR', amount: '3024000000', status: 'valued' },
        ],
      },
      {
        view: 'contribution_margin',
        policyVersion: 2,
        amounts: [
          { currency: 'USD', amount: '5250', status: 'valued' },
          { currency: 'IRR', amount: '3150000000', status: 'valued' },
        ],
      },
    );
    expect(values).toEqual({
      oldView: 'economic_impact',
      newView: 'contribution_margin',
      viewChanged: true,
      currencies: [
        { currency: 'USD', old: '5040', new: '5250', delta: '210' },
        {
          currency: 'IRR',
          old: '3024000000',
          new: '3150000000',
          delta: '126000000',
        },
      ],
    });
  });

  it('an unvalued side leaves the change unknown, never a silent 0; nothing valued is null', () => {
    const values = restatementValues(
      {
        view: 'contribution_margin',
        policyVersion: 1,
        amounts: [{ currency: 'USD', amount: null, status: 'mixed' }],
      },
      {
        view: 'contribution_margin',
        policyVersion: 1,
        amounts: [{ currency: 'USD', amount: '100', status: 'valued' }],
      },
    );
    expect(values?.viewChanged).toBe(false);
    expect(values?.currencies).toEqual([
      { currency: 'USD', old: null, new: '100', delta: null },
    ]);
    expect(restatementValues(undefined, undefined)).toBeNull();
  });
});
