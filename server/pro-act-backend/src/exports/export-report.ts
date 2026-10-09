import { UNVALUED } from '../reconciliation/period-approval-event';
import { CsvValue } from './csv';
import { SliceProductLabel } from './entities/export-job-source.entity';
import { ExportFilters, ExportReportType } from './entities/export-job.entity';

/** What the renderer reads of an approval snapshot (`content.reviewed`, plan 2.8 `reviewedContent`). */
export interface ReviewedSnapshot {
  utcStart: string;
  utcEnd: string;
  run: { id: string } | null;
  actuals: Array<{
    sliceId: string;
    qualityState: string;
    coverageRatio: string | null;
  }>;
  slices: Array<{
    sliceId: string;
    uom: string | null;
    target: string | null;
    actual: string | null;
    gap: string | null;
    attributed: string | null;
    toleranceAdjustment: string | null;
    residual: string | null;
    overAccounted: string | null;
    overproduction: string | null;
    flags: string[];
  }>;
  candidates: Array<{
    lossLineId: string;
    autoKey: string | null;
    sliceId: string;
    kind: string;
    quantity: string | null;
    basis: string | null;
    reasonCodeId: string | null;
    impactCodeId: string | null;
    causeEventId: string | null;
    state: string;
    effectiveQuantity: string | null;
  }>;
  lines: Array<{
    id: string;
    action: string;
    autoKey: string | null;
    sliceId: string;
    kind: string | null;
    quantity: string | null;
    uom: string | null;
    basis: string | null;
    reasonCodeId: string | null;
    impactCodeId: string | null;
    reason: string | null;
  }>;
}

/** One pinned source with its snapshot, as the renderer loads it. */
export interface RenderSource {
  periodId: string;
  unitId: string;
  unitName: string | null;
  revisionId: string;
  revision: number;
  snapshotId: string;
  approvedAt: string;
  sliceProducts: Record<string, SliceProductLabel>;
  reviewed: ReviewedSnapshot;
}

/** Header facts of an export (AN03): everything here is fixed when the job is requested. */
export interface ExportHeader {
  jobId: string;
  reportType: ExportReportType;
  revisionSelector: string;
  filters: ExportFilters;
  requestedAt: string;
  requestedBy: string;
  sourceCount: number;
}

const SOURCE_COLUMNS = [
  'period_id',
  'unit_id',
  'unit_name',
  'utc_start',
  'utc_end',
  'revision_id',
  'revision',
  'approval_snapshot_id',
  'calculation_run_id',
  'approved_at',
  'slice_id',
  'product_id',
  'product_name',
];
const VALUATION_COLUMNS = [
  'value',
  'currency',
  'valuation_status',
  'valuation_reason',
];

export const REPORT_COLUMNS: Record<ExportReportType, readonly string[]> = {
  period_summary: [
    ...SOURCE_COLUMNS,
    'uom',
    'target',
    'actual',
    'gap',
    'attributed',
    'tolerance_adjustment',
    'residual',
    'over_accounted',
    'overproduction',
    'actuals_quality',
    'coverage_ratio',
    'flags',
    ...VALUATION_COLUMNS,
  ],
  loss_lines: [
    ...SOURCE_COLUMNS,
    'line_source',
    'line_id',
    'auto_key',
    'kind',
    'state',
    'quantity',
    'effective_quantity',
    'uom',
    'basis',
    'reason_code_id',
    'impact_code_id',
    'cause_event_id',
    'reason',
    ...VALUATION_COLUMNS,
  ],
};

const VALUATION_CELLS: CsvValue[] = [
  null,
  null,
  UNVALUED.status,
  UNVALUED.reason,
];

/** Lines that add a quantity of their own (decisions on candidates are shown on the candidate rows). */
const OWN_QUANTITY_ACTIONS = new Set(['manual', 'replace', 'tolerance']);

const joined = (values: readonly string[] | null) =>
  values && values.length > 0 ? values.join(';') : null;

/** Key/value records above the table: scope, filters, timezone, status, valuation and source count. */
export function headerRecords(header: ExportHeader): CsvValue[][] {
  const { filters } = header;
  return [
    ['report', header.reportType],
    ['status', 'approved'],
    ['export_id', header.jobId],
    ['requested_at', header.requestedAt],
    ['requested_by', header.requestedBy],
    ['timezone', 'UTC'],
    ['revision_selector', header.revisionSelector],
    ['filter_from', filters.from],
    ['filter_to', filters.to],
    ['filter_unit_ids', joined(filters.unitIds)],
    ['filter_revision_ids', joined(filters.revisionIds)],
    ['source_revisions', header.sourceCount],
    ['valuation', `${UNVALUED.status}: ${UNVALUED.reason}`],
  ];
}

function sourceCells(source: RenderSource, sliceId: string): CsvValue[] {
  const product = source.sliceProducts[sliceId];
  return [
    source.periodId,
    source.unitId,
    source.unitName,
    source.reviewed.utcStart,
    source.reviewed.utcEnd,
    source.revisionId,
    source.revision,
    source.snapshotId,
    source.reviewed.run?.id ?? null,
    source.approvedAt,
    sliceId,
    product?.productId ?? null,
    product?.productName ?? null,
  ];
}

function summaryRows(source: RenderSource): CsvValue[][] {
  return source.reviewed.slices.map((slice) => {
    const actuals = source.reviewed.actuals.find(
      (a) => a.sliceId === slice.sliceId,
    );
    return [
      ...sourceCells(source, slice.sliceId),
      slice.uom,
      slice.target,
      slice.actual,
      slice.gap,
      slice.attributed,
      slice.toleranceAdjustment,
      slice.residual,
      slice.overAccounted,
      slice.overproduction,
      actuals?.qualityState ?? null,
      actuals?.coverageRatio ?? null,
      joined(slice.flags),
      ...VALUATION_CELLS,
    ];
  });
}

function uomOf(source: RenderSource, sliceId: string): string | null {
  return source.reviewed.slices.find((s) => s.sliceId === sliceId)?.uom ?? null;
}

function candidateRows(source: RenderSource): CsvValue[][] {
  return source.reviewed.candidates.map((c) => [
    ...sourceCells(source, c.sliceId),
    'candidate',
    c.lossLineId,
    c.autoKey,
    c.kind,
    c.state,
    c.quantity,
    c.effectiveQuantity,
    uomOf(source, c.sliceId),
    c.basis,
    c.reasonCodeId,
    c.impactCodeId,
    c.causeEventId,
    null,
    ...VALUATION_CELLS,
  ]);
}

function ownLineRows(source: RenderSource): CsvValue[][] {
  return source.reviewed.lines
    .filter((l) => OWN_QUANTITY_ACTIONS.has(l.action))
    .map((l) => [
      ...sourceCells(source, l.sliceId),
      l.action,
      l.id,
      l.autoKey,
      l.kind,
      'in_force',
      l.quantity,
      l.quantity,
      l.uom ?? uomOf(source, l.sliceId),
      l.basis,
      l.reasonCodeId,
      l.impactCodeId,
      null,
      l.reason,
      ...VALUATION_CELLS,
    ]);
}

function lossRows(source: RenderSource): CsvValue[][] {
  return [...candidateRows(source), ...ownLineRows(source)];
}

/** Table rows of one source revision, in snapshot order. */
export function reportRows(
  type: ExportReportType,
  source: RenderSource,
): CsvValue[][] {
  return type === 'period_summary' ? summaryRows(source) : lossRows(source);
}

/** Narrows a stored snapshot `content` to what the renderer needs (throws on an unexpected shape). */
export function reviewedOf(content: Record<string, unknown>): ReviewedSnapshot {
  const reviewed = content.reviewed;
  if (typeof reviewed !== 'object' || reviewed === null) {
    throw new Error('approval snapshot without reviewed content');
  }
  const candidate = reviewed as Partial<ReviewedSnapshot>;
  const lists = [
    candidate.slices,
    candidate.actuals,
    candidate.candidates,
    candidate.lines,
  ];
  if (!lists.every(Array.isArray) || typeof candidate.utcStart !== 'string') {
    throw new Error('approval snapshot content has an unexpected shape');
  }
  return candidate as ReviewedSnapshot;
}
