import { csvRow } from './csv';
import {
  headerRecords,
  RenderSource,
  REPORT_COLUMNS,
  reportRows,
  reviewedOf,
} from './export-report';

const SLICE = '11111111-1111-4111-8111-111111111111';

function source(): RenderSource {
  return {
    periodId: 'period-1',
    unitId: 'unit-1',
    unitName: '=cmd|calc',
    revisionId: 'revision-1',
    revision: 2,
    snapshotId: 'snapshot-1',
    approvedAt: '2027-03-01T12:00:00.000Z',
    sliceProducts: { [SLICE]: { productId: 'product-1', productName: 'HDPE' } },
    reviewed: reviewedOf({
      reviewed: {
        utcStart: '2027-03-01T02:30:00.000Z',
        utcEnd: '2027-03-01T10:30:00.000Z',
        run: { id: 'run-1' },
        actuals: [{ sliceId: SLICE, qualityState: 'good', coverageRatio: '1' }],
        slices: [
          {
            sliceId: SLICE,
            uom: 't',
            target: '1000',
            actual: '850',
            gap: '150',
            attributed: '150',
            toleranceAdjustment: '0',
            residual: '0',
            overAccounted: null,
            overproduction: null,
            flags: [],
          },
        ],
        candidates: [
          {
            lossLineId: 'line-a',
            autoKey: 'auto-a',
            sliceId: SLICE,
            kind: 'availability',
            quantity: '90',
            basis: 'planning_rate',
            reasonCodeId: null,
            impactCodeId: null,
            causeEventId: 'event-1',
            state: 'rejected',
            effectiveQuantity: '0',
          },
        ],
        lines: [
          {
            id: 'manual-1',
            action: 'manual',
            autoKey: null,
            sliceId: SLICE,
            kind: 'availability',
            quantity: '150',
            uom: 't',
            basis: 'measured',
            reasonCodeId: 'reason-1',
            impactCodeId: null,
            reason: '@SUM(1)',
          },
          {
            id: 'reject-1',
            action: 'reject',
            autoKey: 'auto-a',
            sliceId: SLICE,
            kind: null,
            quantity: null,
            uom: null,
            basis: null,
            reasonCodeId: null,
            impactCodeId: null,
            reason: 'not the cause',
          },
        ],
      },
    }),
  };
}

describe('export report rows (plan 2.9, AN03)', () => {
  it('period summary: one row per slice with decimal strings, run id, product and unvalued valuation', () => {
    const [row] = reportRows('period_summary', source());
    const record = Object.fromEntries(
      REPORT_COLUMNS.period_summary.map((column, i) => [column, row[i]]),
    );
    expect(record).toMatchObject({
      revision_id: 'revision-1',
      revision: 2,
      calculation_run_id: 'run-1',
      approval_snapshot_id: 'snapshot-1',
      product_name: 'HDPE',
      target: '1000',
      gap: '150',
      residual: '0',
      actuals_quality: 'good',
      value: null,
      currency: null,
      valuation_status: 'unvalued',
    });
    expect(row).toHaveLength(REPORT_COLUMNS.period_summary.length);
  });

  it('loss lines: candidates with their decision, and only lines carrying their own quantity', () => {
    const rows = reportRows('loss_lines', source());
    const col = (name: string) => REPORT_COLUMNS.loss_lines.indexOf(name);
    expect(
      rows.map((r) => [
        r[col('line_source')],
        r[col('state')],
        r[col('effective_quantity')],
      ]),
    ).toEqual([
      ['candidate', 'rejected', '0'],
      ['manual', 'in_force', '150'],
    ]);
    expect(rows[0][col('cause_event_id')]).toBe('event-1');
    expect(csvRow(rows[1])).toContain(",'@SUM(1),");
    expect(csvRow(rows[1])).toContain(",'=cmd|calc,");
  });

  it('header names status, scope, filters and the source count', () => {
    const records = headerRecords({
      jobId: 'job-1',
      reportType: 'period_summary',
      revisionSelector: 'published',
      filters: { from: 'a', to: 'b', unitIds: ['u1', 'u2'], revisionIds: null },
      requestedAt: '2027-03-02T00:00:00.000Z',
      requestedBy: 'user-1',
      sourceCount: 3,
    });
    const map = Object.fromEntries(
      records.map((record): [string, unknown] => [
        String(record[0]),
        record[1],
      ]),
    );
    expect(map).toMatchObject({
      status: 'approved',
      timezone: 'UTC',
      filter_unit_ids: 'u1;u2',
      filter_revision_ids: null,
      source_revisions: 3,
    });
  });

  it('refuses a snapshot without reviewed content', () => {
    expect(() => reviewedOf({})).toThrow('reviewed content');
    expect(() => reviewedOf({ reviewed: { utcStart: 'x' } })).toThrow(
      'unexpected shape',
    );
  });
});
