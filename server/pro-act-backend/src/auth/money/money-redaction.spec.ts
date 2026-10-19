import { anonymousContext } from '../../common/context/request-context';
import { canViewMoney } from './money-access';
import { withoutMoney } from './money-redaction';

describe('canViewMoney (QA re-test 2026-10-19: no money for operators)', () => {
  const withRoles = (roles: string[], isSuperAdmin = false) => ({
    ...anonymousContext('c'),
    userId: 'u',
    roles,
    isSuperAdmin,
  });

  it('refuses the operations-only roles and callers without a role', () => {
    expect(canViewMoney(withRoles(['operator']))).toBe(false);
    expect(canViewMoney(withRoles(['Operator', 'operator']))).toBe(false);
    expect(canViewMoney(withRoles([]))).toBe(false);
  });

  it('admits every other role, SuperAdmin and system work without a request', () => {
    expect(canViewMoney(withRoles(['finance_approver']))).toBe(true);
    expect(canViewMoney(withRoles(['operator', 'production_engineer']))).toBe(
      true,
    );
    expect(canViewMoney(withRoles(['viewer']))).toBe(true);
    expect(canViewMoney(withRoles([], true))).toBe(true);
    expect(canViewMoney(undefined)).toBe(true);
  });
});

describe('withoutMoney', () => {
  it('leaves out money rows and an array that held only money rows', () => {
    const body = {
      data: {
        eventId: 'e1',
        quantities: [{ uom: 't', quantity: '28' }],
        values: [
          {
            currency: 'USD',
            amount: '4200',
            status: 'valued',
            fxProvisional: false,
          },
          {
            currency: 'IRR',
            amount: null,
            status: 'unvalued',
            fxProvisional: false,
          },
        ],
        valuationView: 'contribution_margin',
      },
    };
    expect(withoutMoney(body)).toEqual({
      data: { eventId: 'e1', quantities: [{ uom: 't', quantity: '28' }] },
    });
  });

  it('keeps an empty array and quantities that carry no currency', () => {
    expect(
      withoutMoney({ values: [], rate: { value: '12', currency: null } }),
    ).toEqual({
      values: [],
      rate: { value: '12', currency: null },
    });
  });

  it('leaves out the shared money keys at any depth, and a money row held as a property', () => {
    const body = {
      items: [
        {
          id: 'a1',
          claimedAvoidedLoss: { amount: '4200', currency: 'USD' },
          claimedCurrency: 'USD',
          history: {
            values: {
              claimedAvoidedLoss: { from: null, to: '4200' },
              status: { from: 'Open', to: 'Done' },
            },
          },
        },
      ],
      outcome: {
        claimedAvoided: [{ currency: 'USD', amount: '4200', actions: 1 }],
        actions: 1,
      },
      line: { quantity: '5', valuation: { lines: [] } },
      value: { currency: 'USD', amount: '10', status: 'valued' },
    };
    expect(withoutMoney(body)).toEqual({
      items: [
        {
          id: 'a1',
          history: { values: { status: { from: 'Open', to: 'Done' } } },
        },
      ],
      outcome: { actions: 1 },
      line: { quantity: '5' },
    });
  });

  it('leaves out restatement deltas and change-set fields formatted as money', () => {
    const body = {
      currencies: [{ currency: 'USD', old: '5040', new: '5250', delta: '210' }],
      fields: [
        {
          key: 'qty',
          format: 'quantity',
          before: '1',
          after: '2',
          currency: null,
        },
        {
          key: 'value:USD',
          format: 'money',
          before: '1',
          after: '2',
          currency: 'USD',
        },
      ],
    };
    expect(withoutMoney(body)).toEqual({
      fields: [
        {
          key: 'qty',
          format: 'quantity',
          before: '1',
          after: '2',
          currency: null,
        },
      ],
    });
  });

  it('leaves out the route keys and does not mutate the input', () => {
    const body = { items: [{ id: 'e1', cost: '100', quantity: '3' }] };
    expect(withoutMoney(body, ['cost'])).toEqual({
      items: [{ id: 'e1', quantity: '3' }],
    });
    expect(body.items[0].cost).toBe('100');
  });

  it('passes scalars, dates and buffers through', () => {
    const at = new Date('2026-10-17T02:30:00Z');
    const file = Buffer.from('x');
    expect(withoutMoney('text')).toBe('text');
    expect(withoutMoney(undefined)).toBeUndefined();
    expect(withoutMoney({ at, file })).toEqual({ at, file });
  });

  it('answers an empty body when the whole body is money', () => {
    expect(withoutMoney([{ currency: 'USD', amount: '1' }])).toEqual([]);
    expect(withoutMoney({ currency: 'USD', amount: '1' })).toEqual({});
  });
});
