import {
  MonthCloseStep,
  monthCloseSelfDecisions,
} from './month-close-self-decisions';

let clock = 0;
const step = (id: string, action: string, actorId: string): MonthCloseStep => ({
  id,
  action,
  actorId,
  createdAt: new Date(Date.UTC(2027, 3, 1) + ++clock * 60_000),
});

describe('monthCloseSelfDecisions (item 1.3)', () => {
  it('independent signers: no self-decision', () => {
    const history = [
      step('q', 'close_quantities', 'ops'),
      step('m', 'review_materiality', 'ctrl'),
      step('f', 'sign_off_finance', 'fin'),
      step('l', 'lock', 'ops'),
    ];
    expect(monthCloseSelfDecisions(history)).toEqual(new Set());
  });

  it('one person closing, reviewing and signing off: review and sign-off are self-decisions (newest-first input)', () => {
    const history = [
      step('q', 'close_quantities', 'sa'),
      step('m', 'review_materiality', 'sa'),
      step('f', 'sign_off_finance', 'sa'),
      step('l', 'lock', 'sa'),
    ].reverse();
    expect(monthCloseSelfDecisions(history)).toEqual(new Set(['m', 'f']));
  });

  it('a finance sign-off by the materiality reviewer is a self-decision', () => {
    const history = [
      step('q', 'close_quantities', 'ops'),
      step('m', 'review_materiality', 'sa'),
      step('f', 'sign_off_finance', 'sa'),
    ];
    expect(monthCloseSelfDecisions(history)).toEqual(new Set(['f']));
  });

  it('a reopen starts a new cycle: an earlier closer signing off later is independent', () => {
    const history = [
      step('q1', 'close_quantities', 'sa'),
      step('r', 'reopen', 'fin'),
      step('q2', 'close_quantities', 'ops'),
      step('f', 'sign_off_finance', 'sa'),
    ];
    expect(monthCloseSelfDecisions(history)).toEqual(new Set());
  });
});
