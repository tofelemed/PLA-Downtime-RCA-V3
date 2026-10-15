import { EntityManager } from 'typeorm';
import {
  componentGroups,
  NOT_BROKEN_DOWN,
  UNVALUED,
} from './loss-value-components';
import { ReportScope } from './report-scope';

type Row = {
  component: string;
  currency: string;
  uom: string | null;
  amount: string | null;
  lines: number;
  fx_missing: number;
  fx_provisional: number;
  quantity: string | null;
  reasons: string[] | null;
};

const row = (over: Partial<Row>): Row => ({
  component: 'rework_cost',
  currency: 'USD',
  uom: 't',
  amount: '600',
  lines: 1,
  fx_missing: 0,
  fx_provisional: 0,
  quantity: '10',
  reasons: null,
  ...over,
});

const SCOPE: ReportScope = {
  tenantId: 't1',
  unitIds: ['u1'],
  restricted: null,
  from: new Date('2027-03-01T00:00:00Z'),
  to: new Date('2027-03-02T00:00:00Z'),
  approvedOnly: false,
  weekStart: 'saturday',
};

function managerOf(rows: Row[]): {
  manager: EntityManager;
  calls: unknown[][];
} {
  const calls: unknown[][] = [];
  const manager = {
    query: (sql: string, params: unknown[]) => {
      calls.push([sql, params]);
      return Promise.resolve(rows);
    },
  } as unknown as EntityManager;
  return { manager, calls };
}

describe('VA-04 economic view by component (loss-value groupBy=component)', () => {
  it('orders the parts, then the not-broken-down and unvalued buckets, with status per currency', async () => {
    const { manager, calls } = managerOf([
      row({
        component: UNVALUED,
        amount: null,
        lines: 2,
        quantity: '4',
        reasons: ['demand_status_missing'],
      }),
      row({
        component: 'displaced_contribution',
        amount: '3000',
        quantity: '10',
      }),
      row({ component: NOT_BROKEN_DOWN, amount: '500', quantity: '5' }),
      row({
        component: 'rework_cost',
        currency: 'IRR',
        amount: null,
        fx_missing: 1,
      }),
      row({ component: 'rework_cost' }),
      row({
        component: 'yield_loss_variable_cost',
        amount: '700',
        quantity: '1',
        fx_provisional: 1,
      }),
    ]);
    const groups = await componentGroups(manager, SCOPE, {
      ledger: 'plan',
      kinds: ['quality'],
    });
    expect(groups.map((g) => g.key)).toEqual([
      'displaced_contribution',
      'rework_cost',
      'yield_loss_variable_cost',
      NOT_BROKEN_DOWN,
      UNVALUED,
    ]);
    const rework = groups.find((g) => g.key === 'rework_cost');
    expect(rework?.currencies).toEqual([
      {
        currency: 'IRR',
        amount: null,
        status: 'unvalued',
        fxProvisional: false,
        reasons: ['fx_rate_missing'],
        lines: 1,
      },
      {
        currency: 'USD',
        amount: '600',
        status: 'valued',
        fxProvisional: false,
        reasons: [],
        lines: 1,
      },
    ]);
    expect(rework?.quantities).toEqual([{ uom: 't', quantity: '10' }]);
    const yieldLoss = groups.find((g) => g.key === 'yield_loss_variable_cost');
    expect(yieldLoss?.currencies[0]).toMatchObject({
      fxProvisional: true,
      reasons: ['fx_rate_provisional'],
    });
    const unvalued = groups.find((g) => g.key === UNVALUED);
    expect(unvalued?.currencies[0]).toMatchObject({
      amount: null,
      status: 'unvalued',
      reasons: ['demand_status_missing'],
    });
    // tenant, units, window, approvedOnly from the report scope; the economic view; ledger; loss kinds
    expect(calls[0][1]).toEqual([
      't1',
      ['u1'],
      SCOPE.from,
      SCOPE.to,
      false,
      'economic_impact',
      'plan',
      ['quality'],
    ]);
  });

  it('a component some of whose lines lack an FX rate is mixed with no amount (never a partial sum)', async () => {
    const { manager } = managerOf([
      row({
        component: 'lost_contribution',
        amount: '300',
        lines: 2,
        fx_missing: 1,
      }),
    ]);
    const [group] = await componentGroups(manager, SCOPE, {
      ledger: 'plan',
      kinds: ['availability'],
    });
    expect(group.currencies[0]).toMatchObject({
      amount: null,
      status: 'mixed',
      reasons: ['fx_rate_missing'],
    });
  });
});
