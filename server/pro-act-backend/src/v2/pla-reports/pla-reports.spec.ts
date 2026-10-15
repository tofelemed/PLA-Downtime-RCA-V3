import { LossTreeCell } from './loss-tree-report';
import { lossTreeView } from './loss-tree-view';
import { isoWeek } from '../../domain/calendar/week-start';

const cell = (over: Partial<LossTreeCell>): LossTreeCell => ({
  group_key: null,
  unit: 't',
  amount: '0',
  lines: 1,
  valued: 0,
  unvalued: 0,
  fx_missing: 0,
  fx_provisional: 0,
  reasons: null,
  ...over,
});

const request = {
  groupBy: 'reason' as const,
  ledger: 'plan' as const,
  calculationRunIds: [],
  defaultView: false,
  periods: 2,
  approvedPeriods: 1,
};

describe('PLA analytics pure parts (plan 3.6)', () => {
  it('isoWeek gives the ISO 8601 week key of an operational date (2.7 SQL IYYY-"W"IW)', () => {
    expect(isoWeek('2027-03-01')).toBe('2027-W09');
    expect(isoWeek('2027-01-03')).toBe('2026-W53');
    expect(isoWeek('2026-12-31')).toBe('2026-W53');
    expect(isoWeek('2025-12-29')).toBe('2026-W01');
  });

  it('loss tree quantities: largest first, shares and the cumulative Pareto line in decimals', () => {
    const view = lossTreeView(
      {
        rows: [
          cell({ group_key: 'b', amount: '10' }),
          cell({ group_key: 'a', amount: '30' }),
        ],
        labels: new Map([['a', 'A reason']]),
      },
      { ...request, metric: 'qty' },
    );
    expect(
      view.groups.map((g) => [g.key, g.amount, g.share, g.cumulativeShare]),
    ).toEqual([
      ['a', '30', '0.75', '0.75'],
      ['b', '10', '0.25', '1'],
    ]);
    expect(view.totals).toEqual([
      expect.objectContaining({ unit: 't', amount: '40', status: 'quantity' }),
    ]);
  });

  it('loss tree values: unvalued → null (never 0), FX missing → null total, mixed keeps the valued sum', () => {
    const view = lossTreeView(
      {
        rows: [
          cell({
            group_key: 'a',
            unit: 'USD',
            amount: '5',
            valued: 1,
            unvalued: 1,
            reasons: ['policy_unapproved'],
          }),
          cell({
            group_key: 'b',
            unit: 'USD',
            amount: null,
            valued: 0,
            unvalued: 2,
            reasons: ['policy_unapproved'],
          }),
          cell({
            group_key: 'a',
            unit: 'IRR',
            amount: null,
            valued: 1,
            fx_missing: 1,
            reasons: ['fx_rate_missing'],
          }),
        ],
        labels: new Map(),
      },
      { ...request, metric: 'margin' },
    );
    const usd = view.groups.filter((g) => g.unit === 'USD');
    expect(usd.map((g) => [g.key, g.amount, g.status])).toEqual([
      ['a', '5', 'mixed'],
      ['b', null, 'unvalued'],
    ]);
    expect(view.totals.find((t) => t.unit === 'IRR')).toMatchObject({
      amount: null,
      status: 'mixed',
    });
    expect(view.totals.find((t) => t.unit === 'USD')).toMatchObject({
      amount: '5',
      status: 'mixed',
    });
  });

  it('loss tree economic view (SME V7 / V8): provisional-rate amounts are summed and flagged, status as in loss-value', () => {
    const view = lossTreeView(
      {
        rows: [
          cell({
            group_key: 'a',
            unit: 'USD',
            amount: '50',
            valued: 1,
            fx_provisional: 1,
            reasons: ['fx_rate_provisional'],
          }),
          cell({ group_key: 'b', unit: 'USD', amount: '30', valued: 1 }),
        ],
        labels: new Map(),
      },
      {
        ...request,
        metric: 'economic_impact',
        defaultView: true,
        approvedPeriods: 2,
      },
    );
    expect(view).toMatchObject({
      metric: 'economic_impact',
      view: 'economic_impact',
      defaultView: true,
      valuationStatus: 'approved',
    });
    expect(view.groups.map((g) => [g.key, g.status, g.fxProvisional])).toEqual([
      ['a', 'valued', true],
      ['b', 'valued', false],
    ]);
    expect(view.totals[0]).toMatchObject({
      amount: '80',
      status: 'valued',
      fxProvisional: true,
      reasons: ['fx_rate_provisional'],
    });
  });

  it('loss tree quantity view has no valuation view and is provisional while a period is open', () => {
    const view = lossTreeView(
      { rows: [cell({ group_key: 'a', amount: '1' })], labels: new Map() },
      { ...request, metric: 'qty' },
    );
    expect(view).toMatchObject({ view: null, valuationStatus: 'provisional' });
    expect(view.totals[0].fxProvisional).toBe(false);
  });
});
