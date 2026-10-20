import {
  ExceptionRow,
  exceptionsQuery,
  ExceptionsFilter,
} from './exceptions-sql';
import { EXCEPTION_TYPES } from './exceptions-v2.dto';
import { toExceptionView } from './exceptions-v2.view';

const PERIOD = '11111111-1111-4111-8111-111111111111';

function row(extra: Partial<ExceptionRow>): ExceptionRow {
  return {
    period_id: PERIOD,
    type: 'residual_beyond_tolerance',
    n: 1,
    amount: null,
    uom: null,
    detail: null,
    ref_id: null,
    ref_event_id: null,
    unit_id: 'unit-1',
    unit_name: 'Extruder',
    plan_id: 'plan-1',
    local_date: '2027-03-01',
    shift_name: 'A',
    utc_start: new Date('2027-03-01T02:30:00Z'),
    utc_end: new Date('2027-03-01T10:30:00Z'),
    workflow: 'draft',
    revision: 1,
    ...extra,
  };
}

const filter = (extra: Partial<ExceptionsFilter> = {}): ExceptionsFilter => ({
  tenantId: 'tenant-a',
  unitIds: null,
  fromDate: '2027-03-01',
  toDate: '2027-04-01',
  types: EXCEPTION_TYPES,
  workflows: ['none', 'draft', 'in_review', 'stale'],
  after: null,
  limit: 50,
  ...extra,
});

describe('accounting exceptions rows (plan 2.4)', () => {
  it('a residual names its quantity and opens the reconciliation section of the period', () => {
    const view = toExceptionView(row({ amount: '12.50000000', uom: 't' }));
    expect(view.id).toBe(`${PERIOD}:residual_beyond_tolerance`);
    expect(view.message).toBe(
      'Residual 12.5 t beyond tolerance in the latest calculation',
    );
    expect(view.target).toEqual({
      screen: 'period',
      planId: 'plan-1',
      periodId: PERIOD,
      section: 'reconciliation',
    });
  });

  it('stale submissions open Review & close, substitute sources Actuals & quality', () => {
    const stale = toExceptionView(
      row({
        type: 'stale_submission',
        workflow: 'stale',
        detail: 'events changed',
      }),
    );
    expect(stale.message).toBe(
      'The submitted reconciliation is stale: events changed',
    );
    expect(stale.target).toMatchObject({ screen: 'period', section: 'review' });
    const substitute = toExceptionView(
      row({ type: 'substitute_source', n: 2, detail: 'Silo level' }),
    );
    expect(substitute.message).toBe(
      'Actuals of 2 product slices come from a substitute source (Silo level)',
    );
    expect(substitute.target).toMatchObject({
      screen: 'period',
      section: 'actuals',
    });
  });

  it('uncoded stops open the period’s uncoded stops in the Event Hub', () => {
    const view = toExceptionView(row({ type: 'uncoded_stop_time', n: 3 }));
    expect(view.message).toBe('3 stops without a reason in this period');
    expect(view.target).toEqual({
      screen: 'events',
      unitId: 'unit-1',
      from: '2027-03-01T02:30:00.000Z',
      to: '2027-03-01T10:30:00.000Z',
      filter: 'uncoded',
    });
  });

  it('one duplicate suggestion opens its review; several open the list of the unit', () => {
    const one = toExceptionView(
      row({
        type: 'duplicate_merge_pending',
        ref_id: 'sr-1',
        ref_event_id: 'ev-1',
      }),
    );
    expect(one.target).toEqual({
      screen: 'stop_merge',
      eventId: 'ev-1',
      reconciliationId: 'sr-1',
    });
    expect(one.message).toBe(
      '1 duplicate-stop suggestion waits for a decision',
    );
    const many = toExceptionView(
      row({
        type: 'duplicate_merge_pending',
        n: 2,
        ref_id: 'sr-1',
        ref_event_id: 'ev-1',
      }),
    );
    expect(many.target).toMatchObject({
      screen: 'stop_merges',
      unitId: 'unit-1',
    });
  });

  it('a period without a plan has no period link', () => {
    expect(
      toExceptionView(row({ type: 'bridge_required', plan_id: null })).target,
    ).toEqual({ screen: 'none' });
  });
});

describe('exceptions query (plan 2.4)', () => {
  it('runs one UNION ALL part per requested type, never interpolating values', () => {
    const all = exceptionsQuery(filter());
    expect(all.sql.match(/UNION ALL/g)).toHaveLength(
      EXCEPTION_TYPES.length - 1,
    );
    const two = exceptionsQuery(
      filter({ types: ['stale_submission', 'uncoded_stop_time'] }),
    );
    expect(two.sql.match(/UNION ALL/g)).toHaveLength(1);
    expect(two.sql).not.toContain('period_ledger_totals');
    expect(two.values).toContain('tenant-a');
    expect(two.sql).not.toContain('tenant-a');
  });

  it('pushes the keyset start into the period scan and pages on (start, period, type)', () => {
    const after = {
      utcStart: '2027-03-01T02:30:00.000Z',
      periodId: PERIOD,
      type: 'bridge_required' as const,
    };
    const query = exceptionsQuery(filter({ after, limit: 10 }));
    expect(query.sql).toContain('(p."utc_start", p."id") >=');
    expect(query.sql).toContain('(o."utc_start", o."period_id", f."type") >');
    expect(query.values).toContain(11);
    expect(query.values).toContain(PERIOD);
  });
});
