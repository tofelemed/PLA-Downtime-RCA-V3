import {
  attributedPeriods,
  QuantityRow,
  ValueRow,
} from './event-attributed-losses.view';

function quantity(
  period: string,
  overrides: Partial<QuantityRow> = {},
): QuantityRow {
  return {
    period_id: period,
    unit_id: 'unit-1',
    local_date: '2026-10-01',
    shift_name: 'A',
    utc_start: new Date('2026-10-01T06:00:00Z'),
    utc_end: new Date('2026-10-01T14:00:00Z'),
    plan_version_id: 'pv-1',
    plan_id: 'plan-1',
    revision_id: `rev-${period}`,
    revision: 1,
    lifecycle: 'approved',
    status: 'approved',
    kind: 'availability',
    uom: 't',
    quantity: '125',
    lines: 1,
    ...overrides,
  };
}

function value(period: string, overrides: Partial<ValueRow> = {}): ValueRow {
  return {
    period_id: period,
    revision_id: `rev-${period}`,
    currency: 'USD',
    amount: '1000',
    valued: 1,
    unvalued: 0,
    provisional: 0,
    ...overrides,
  };
}

describe('attributed losses of an event (UX G-2b)', () => {
  it('groups kinds and currencies per period revision with their status', () => {
    const { items, truncated } = attributedPeriods(
      [
        quantity('p1'),
        quantity('p1', { kind: 'performance', quantity: '5' }),
        quantity('p1', {
          revision_id: 'rev-open',
          revision: 2,
          lifecycle: 'draft',
          status: 'provisional',
          quantity: '130',
        }),
      ],
      [
        value('p1'),
        value('p1', { currency: 'IRR', amount: null, valued: 0, unvalued: 2 }),
        value('p1', {
          revision_id: 'rev-open',
          valued: 1,
          unvalued: 1,
          provisional: 1,
        }),
      ],
      200,
    );
    expect(truncated).toBe(false);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      periodId: 'p1',
      planId: 'plan-1',
      planVersionId: 'pv-1',
      revisionId: 'rev-p1',
      status: 'approved',
      utcStart: '2026-10-01T06:00:00.000Z',
      quantities: [
        { kind: 'availability', uom: 't', quantity: '125', lines: 1 },
        { kind: 'performance', uom: 't', quantity: '5', lines: 1 },
      ],
      values: [
        {
          currency: 'USD',
          amount: '1000',
          status: 'valued',
          fxProvisional: false,
        },
        { currency: 'IRR', amount: null, status: 'unvalued' },
      ],
    });
    expect(items[1]).toMatchObject({
      revisionId: 'rev-open',
      lifecycle: 'draft',
      status: 'provisional',
      values: [{ status: 'mixed', fxProvisional: true, provisionalLines: 1 }],
    });
  });

  it('cuts at the bound and flags truncation (the query reads one period more)', () => {
    const { items, truncated } = attributedPeriods(
      [quantity('p1'), quantity('p2'), quantity('p3')],
      [value('p3')],
      2,
    );
    expect(items.map((i) => i.periodId)).toEqual(['p1', 'p2']);
    expect(truncated).toBe(true);
  });

  it('no lines → no items', () => {
    expect(attributedPeriods([], [], 200)).toEqual({
      items: [],
      truncated: false,
    });
  });
});
