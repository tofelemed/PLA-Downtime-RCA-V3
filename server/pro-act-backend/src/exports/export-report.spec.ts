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

function valuation(): NonNullable<RenderSource['reviewed']['valuation']> {
  const amounts = (irr: string) => [
    { currency: 'IRR', amount: irr, reason: null, fxRateIds: [] },
    { currency: 'USD', amount: null, reason: 'fx_rate_missing', fxRateIds: [] },
  ];
  const view = (irr: string) => ({
    view: 'contribution_margin',
    status: 'valued',
    reason: null,
    rateVersionIds: ['rate-1'],
    amounts: amounts(irr),
  });
  return {
    engineVersion: '2.6.0',
    policyId: 'policy-2',
    policyVersion: 2,
    approved: true,
    defaultView: 'contribution_margin',
    currencies: ['IRR', 'USD'],
    timeBasisRule: 'exclusive',
    fxPolicy: 'snapshot',
    lines: [
      {
        source: 'candidate',
        id: 'line-a',
        sliceId: SLICE,
        kind: 'availability',
        quantity: '0',
        views: [view('0')],
      },
      {
        source: 'line',
        id: 'manual-1',
        sliceId: SLICE,
        kind: 'availability',
        quantity: '150',
        views: [view('15000.125')],
      },
    ],
    slices: [
      {
        sliceId: SLICE,
        view: 'contribution_margin',
        currency: 'IRR',
        amount: '15000.125',
        nativeAmount: '15000.125',
        status: 'valued',
        reasons: [],
        unvaluedQuantity: '0',
        unvaluedSeconds: '0',
        valuedLines: 2,
        unvaluedLines: 0,
        fxMissingLines: 0,
        fxRateIds: [],
      },
      {
        sliceId: SLICE,
        view: 'contribution_margin',
        currency: 'USD',
        amount: null,
        nativeAmount: '0',
        status: 'mixed',
        reasons: ['fx_rate_missing'],
        unvaluedQuantity: '0',
        unvaluedSeconds: '0',
        valuedLines: 2,
        unvaluedLines: 0,
        fxMissingLines: 2,
        fxRateIds: [],
      },
    ],
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
      value_1: null,
      currency_1: null,
      valuation_status: 'unvalued',
    });
    expect(row).toHaveLength(REPORT_COLUMNS.period_summary.length);
  });

  it('valued snapshot: each currency rounded half-even to its minor units (IRR 0), status and reason per row (plan 2.6)', () => {
    const valued = source();
    valued.reviewed.valuation = valuation();
    const [summary] = reportRows('period_summary', valued);
    const s = (name: string) =>
      summary[REPORT_COLUMNS.period_summary.indexOf(name)];
    expect([
      s('valuation_view'),
      s('value_1'),
      s('currency_1'),
      s('value_2'),
      s('currency_2'),
      s('valuation_status'),
      s('valuation_reason'),
    ]).toEqual([
      'contribution_margin',
      '15000',
      'IRR',
      null,
      'USD',
      'mixed',
      'fx_rate_missing',
    ]);
    const rows = reportRows('loss_lines', valued);
    const l = (row: number, name: string) =>
      rows[row][REPORT_COLUMNS.loss_lines.indexOf(name)];
    expect([l(1, 'value_1'), l(1, 'valuation_status')]).toEqual([
      '15000',
      'valued',
    ]);
    expect([l(0, 'value_1'), l(0, 'valuation_reason')]).toEqual([
      '0',
      'fx_rate_missing',
    ]);
  });

  it('SME V7: fx_provisional is true on rows whose value used a provisional FX rate, false otherwise', () => {
    const valued = source();
    const base = valuation();
    const usd = {
      currency: 'USD',
      amount: '50',
      reason: null,
      fxRateIds: ['fx-p'],
      provisional: true as const,
    };
    valued.reviewed.valuation = {
      ...base,
      lines: base.lines.map((line) =>
        line.id === 'manual-1'
          ? {
              ...line,
              views: line.views.map((v) => ({
                ...v,
                amounts: [v.amounts[0], usd],
              })),
            }
          : line,
      ),
      slices: base.slices.map((t) => ({
        ...t,
        fxProvisionalLines: 1,
        reasons: ['fx_rate_provisional'],
      })),
    };
    const [summary] = reportRows('period_summary', valued);
    expect(
      summary[REPORT_COLUMNS.period_summary.indexOf('fx_provisional')],
    ).toBe('true');
    const rows = reportRows('loss_lines', valued);
    const col = REPORT_COLUMNS.loss_lines.indexOf('fx_provisional');
    expect(rows.map((r) => r[col])).toEqual(['false', 'true']);
    const [plain] = reportRows('period_summary', source());
    expect(plain[REPORT_COLUMNS.period_summary.indexOf('fx_provisional')]).toBe(
      'false',
    );
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

  it('loss lines carry plant-time, labelled and reason-code columns from the pinned labels', () => {
    const labelled = source();
    labelled.reviewed.candidates[0].reasonCodeId = 'rc-1';
    const rows = reportRows('loss_lines', labelled, {
      requestedByName: 'Sara',
      plantTimezone: 'Asia/Tehran',
      reasonCodes: { 'rc-1': { code: 'MECH-GEARBOX', name: 'Gearbox' } },
    });
    const col = (name: string) => REPORT_COLUMNS.loss_lines.indexOf(name);
    expect(REPORT_COLUMNS.loss_lines.slice(0, 4)).toEqual([
      'period_id',
      'unit_id',
      'unit_name',
      'utc_start',
    ]);
    const pick = (row: unknown[]) =>
      [
        'plant_start',
        'approved_at_plant',
        'line_source_label',
        'kind_label',
        'state_label',
        'reason_code',
        'reason_name',
      ].map((name) => row[col(name)]);
    expect(pick(rows[0])).toEqual([
      '2027-03-01T06:00:00+03:30',
      '2027-03-01T15:30:00+03:30',
      'Calculated',
      'Availability',
      'Rejected',
      'MECH-GEARBOX',
      'Gearbox',
    ]);
    expect(rows[1][col('state_label')]).toBe('In force');
    expect(rows[1][col('reason_code')]).toBeNull();
    expect(
      rows.every((r) => r.length === REPORT_COLUMNS.loss_lines.length),
    ).toBe(true);
    const [summary] = reportRows('period_summary', source());
    expect(summary).toHaveLength(REPORT_COLUMNS.period_summary.length);
    expect(
      summary[REPORT_COLUMNS.period_summary.indexOf('plant_start')],
    ).toBeNull();
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
      labels: {
        requestedByName: 'Sara',
        plantTimezone: 'Asia/Tehran',
        reasonCodes: {},
      },
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
      requested_by_name: 'Sara',
      plant_timezone: 'Asia/Tehran',
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
