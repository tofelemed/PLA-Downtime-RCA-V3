import { ExportReportType } from '../entities/export-job.entity';
import { ExportHeader, RenderSource } from '../export-report';
import { ExportPresentation, PdfColumn } from './pdf-model';
import { lineValue, PrintedValue, sliceValue } from './pdf-value';
import {
  NO_VALUE,
  plantDateTime,
  plantNumber,
  plantRange,
  PlantFormat,
} from './plant-format';

/** Quantities are printed with this many fraction digits (stored values keep 8). */
const QUANTITY_PLACES = 2;

export const REPORT_TITLES: Record<ExportReportType, string> = {
  period_summary: 'Period summary',
  loss_lines: 'Loss lines',
};

/** The content of one approved revision, before it is cut into pages. */
export interface PdfSection {
  heading: string;
  label: { text: string; tone: 'approved' | 'provisional' };
  facts: Array<[string, string]>;
  columns: readonly PdfColumn[];
  rows: string[][];
}

const col = (
  label: string,
  width: number,
  align: PdfColumn['align'] = 'right',
): PdfColumn => ({ label, width, align });

export const PDF_COLUMNS: Record<ExportReportType, readonly PdfColumn[]> = {
  period_summary: [
    col('Product', 16, 'left'),
    col('UoM', 6, 'left'),
    col('Target', 10),
    col('Actual', 10),
    col('Gap', 10),
    col('Attributed', 10),
    col('Residual', 10),
    col('Loss value', 16),
    col('Actuals', 12, 'left'),
  ],
  loss_lines: [
    col('Product', 14, 'left'),
    col('Line', 10, 'left'),
    col('Kind', 12, 'left'),
    col('State', 10, 'left'),
    col('Quantity', 10),
    col('UoM', 6, 'left'),
    col('Basis', 12, 'left'),
    col('Loss value', 14),
    col('Note', 12, 'left'),
  ],
};

const formatOf = (p: ExportPresentation): PlantFormat => ({
  timezone: p.timezone,
  calendar: p.calendar,
  digits: p.digits,
});

const qty = (value: string | null, p: ExportPresentation) =>
  plantNumber(value, QUANTITY_PLACES, p.digits);

const productOf = (source: RenderSource, sliceId: string) =>
  source.sliceProducts[sliceId]?.productName ?? NO_VALUE;

/** Plain words of a loss line's basis (Marun regression G3: the raw key was printed). */
const LOSS_BASIS_WORDS: Readonly<Record<string, string>> = {
  sustained_rate: 'Sustained rate',
  planning_rate: 'Planning rate',
  measured: 'Measured',
  declared: 'Declared',
};

function basisWords(basis: string | null | undefined): string {
  if (!basis) return NO_VALUE;
  return LOSS_BASIS_WORDS[basis] ?? basis.replace(/_/g, ' ');
}

/** Plain words of the valuation basis printed with the loss values (the CSV's `valuation_view`). */
export const VALUATION_BASIS_LABELS: Readonly<Record<string, string>> = {
  contribution_margin: 'Contribution margin',
  standard_cost: 'Standard cost',
  economic_impact: 'Economic impact (lost sales + incremental costs)',
};

const FX_POLICY_LABELS: Readonly<Record<string, string>> = {
  snapshot: 'rates frozen in the approval snapshot',
  none: 'no conversion (values in the policy currency only)',
};

/** The valuation basis of an approved revision's loss values; unvalued snapshots have none. */
export function basisText(source: RenderSource, withPolicy = true): string {
  const valuation = source.reviewed.valuation;
  if (!valuation) return 'Not valued';
  const basis =
    VALUATION_BASIS_LABELS[valuation.defaultView] ?? valuation.defaultView;
  const policy =
    !withPolicy || valuation.policyVersion === null
      ? ''
      : ` (valuation policy version ${valuation.policyVersion})`;
  return `${basis}${policy}`;
}

function fxText(source: RenderSource, provisional: boolean): string {
  const valuation = source.reviewed.valuation;
  if (!valuation) return NO_VALUE;
  const policy = FX_POLICY_LABELS[valuation.fxPolicy] ?? valuation.fxPolicy;
  return provisional
    ? `${policy}; values marked * use a provisional FX rate`
    : policy;
}

const valueCell = (value: PrintedValue) =>
  value.provisional ? `${value.text} *` : value.text;

/**
 * The window on the plant clock, or — for an export of named revisions, which has no window — the
 * selection itself under its own label (Marun regression G3: the count was printed as the window).
 */
function selectionFact(
  filters: ExportHeader['filters'],
  f: PlantFormat,
): [string, string] {
  if (filters.from && filters.to) {
    return ['Window (plant time)', plantRange(filters.from, filters.to, f)];
  }
  const count = filters.revisionIds?.length ?? 0;
  const noun = count === 1 ? 'revision' : 'revisions';
  return ['Selection', `${count} named approved ${noun}`];
}

/** Cover facts: plant, report, window on the plant clock, selection, request, display settings. */
export function coverFacts(
  header: ExportHeader,
  p: ExportPresentation,
): Array<[string, string]> {
  const f = formatOf(p);
  const { filters } = header;
  return [
    ['Plant', p.plantName],
    ['Report', REPORT_TITLES[header.reportType]],
    ['Status', 'Approved revisions only'],
    selectionFact(filters, f),
    ['Period revisions', plantNumber(String(header.sourceCount), 0, p.digits)],
    ['Requested', plantDateTime(header.requestedAt, f)],
    ['Time zone', p.timezone ?? 'UTC'],
    ['Money shown in', p.currency],
    ['Export id', header.jobId],
  ];
}

function summaryRows(source: RenderSource, p: ExportPresentation) {
  const values: PrintedValue[] = [];
  const rows = source.reviewed.slices.map((slice) => {
    const value = sliceValue(
      source.reviewed.valuation,
      slice.sliceId,
      p.currency,
      p.digits,
    );
    values.push(value);
    const actuals = source.reviewed.actuals.find(
      (a) => a.sliceId === slice.sliceId,
    );
    return [
      productOf(source, slice.sliceId),
      slice.uom ?? NO_VALUE,
      qty(slice.target, p),
      qty(slice.actual, p),
      qty(slice.gap, p),
      qty(slice.attributed, p),
      qty(slice.residual, p),
      valueCell(value),
      actuals?.qualityState ?? NO_VALUE,
    ];
  });
  return { rows, values };
}

const OWN_QUANTITY_ACTIONS = new Set(['manual', 'replace', 'tolerance']);

function lossRows(source: RenderSource, p: ExportPresentation) {
  const { reviewed } = source;
  const uomOf = (sliceId: string) =>
    reviewed.slices.find((s) => s.sliceId === sliceId)?.uom ?? NO_VALUE;
  const values: PrintedValue[] = [];
  const valued = (v: PrintedValue) => {
    values.push(v);
    return valueCell(v);
  };
  const candidates = reviewed.candidates.map((c) => [
    productOf(source, c.sliceId),
    'calculated',
    c.kind,
    c.state,
    qty(c.effectiveQuantity ?? c.quantity, p),
    uomOf(c.sliceId),
    basisWords(c.basis),
    valued(
      lineValue(
        reviewed.valuation,
        { source: 'candidate', id: c.lossLineId },
        p.currency,
        p.digits,
      ),
    ),
    NO_VALUE,
  ]);
  const own = reviewed.lines
    .filter((l) => OWN_QUANTITY_ACTIONS.has(l.action))
    .map((l) => [
      productOf(source, l.sliceId),
      l.action,
      l.kind ?? NO_VALUE,
      'in force',
      qty(l.quantity, p),
      l.uom ?? uomOf(l.sliceId),
      basisWords(l.basis),
      valued(
        lineValue(
          reviewed.valuation,
          { source: 'line', id: l.id },
          p.currency,
          p.digits,
        ),
      ),
      l.reason ?? NO_VALUE,
    ]);
  return { rows: [...candidates, ...own], values };
}

/** One approved revision: heading, approval label (provisional FX called out), facts and its table. */
export function sourceSection(
  type: ExportReportType,
  source: RenderSource,
  p: ExportPresentation,
): PdfSection {
  const f = formatOf(p);
  const { rows, values } =
    type === 'period_summary' ? summaryRows(source, p) : lossRows(source, p);
  const provisional = values.some((v) => v.provisional);
  const unit = source.unitName ?? source.unitId;
  return {
    heading: `${unit} · ${plantRange(source.reviewed.utcStart, source.reviewed.utcEnd, f)}`,
    label: provisional
      ? {
          text: 'Approved · values marked * use a provisional FX rate',
          tone: 'provisional',
        }
      : { text: 'Approved', tone: 'approved' },
    facts: [
      [
        'Revision',
        `${plantNumber(String(source.revision), 0, p.digits)} (${source.revisionId})`,
      ],
      ['Approved', plantDateTime(source.approvedAt, f)],
      ['Approval snapshot', source.snapshotId],
      ['Calculation run', source.reviewed.run?.id ?? NO_VALUE],
      ['Loss value basis', basisText(source)],
      ['Exchange rates', fxText(source, provisional)],
    ],
    columns: PDF_COLUMNS[type],
    rows,
  };
}
