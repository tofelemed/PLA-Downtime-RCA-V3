import type { LossStatementQuery } from '@/api/v2/queries/loss-statement';
import type { LossStatementRowView, LossStatementView } from '@/api/v2/types/loss-statement';
import { CHOSEN_DATES_KEY, scopeBase, type AnalyticsScope } from './analytics-scope';

export const STATEMENT_PATH = '/pla-analytics/statement';
/** Rows per keyset page of the statement table. */
export const STATEMENT_PAGE_SIZE = 50;

/** The report query of the section's scope (window, units, Approved only → `revision=approved`). */
export function statementQuery(scope: AnalyticsScope): LossStatementQuery {
  return { ...scopeBase(scope), limit: STATEMENT_PAGE_SIZE };
}

/** The ten figures of a row, in statement order (the table's columns). */
export const STATEMENT_COLUMNS: ReadonlyArray<{ key: keyof LossStatementView; header: string }> = [
  { key: 'planned', header: 'Planned' },
  { key: 'actual', header: 'Actual' },
  { key: 'shortfall', header: 'Shortfall' },
  { key: 'availability', header: 'Downtime' },
  { key: 'performance', header: 'Throughput' },
  { key: 'quality', header: 'Quality' },
  { key: 'grossAttributed', header: 'Gross' },
  { key: 'recovery', header: 'Recovery' },
  { key: 'netAccounted', header: 'Net' },
  { key: 'unaccounted', header: 'Unaccounted' },
];

export interface StatementDay {
  localDate: string;
  rows: LossStatementRowView[];
}

/** Rows grouped under their operational day, in server order (shifts of a day stay together). */
export function groupByDay(rows: readonly LossStatementRowView[]): StatementDay[] {
  const days: StatementDay[] = [];
  for (const row of rows) {
    const last = days[days.length - 1];
    if (last && last.localDate === row.localDate) last.rows.push(row);
    else days.push({ localDate: row.localDate, rows: [row] });
  }
  return days;
}

const CSV_FIGURES: ReadonlyArray<[keyof LossStatementView, string]> = [
  ['planned', 'Planned production'],
  ['actual', 'Actual good production'],
  ['shortfall', 'Production shortfall'],
  ['availability', 'Equipment downtime loss'],
  ['performance', 'Reduced throughput loss'],
  ['quality', 'Quality loss'],
  ['transitionExcess', 'Transition loss'],
  ['unaccountedClassified', 'Classified as unaccounted'],
  ['grossAttributed', 'Gross attributed loss'],
  ['recovery', 'Verified recovery'],
  ['netAccounted', 'Net accounted loss'],
  ['toleranceAdjustment', 'Tolerance adjustment'],
  ['unaccounted', 'Unaccounted loss'],
];

const DECIMAL = /^-?\d+(\.\d+)?$/;
const FORMULA_START = /^[=+\-@\t\r]/;

/** A CSV cell; text a spreadsheet would run as a formula (=, +, -, @, tab, CR) gets a leading quote, decimals stay as sent. */
const cell = (value: string | number | boolean | null | undefined) => {
  const raw = value === null || value === undefined ? '' : String(value);
  const guarded = !DECIMAL.test(raw) && FORMULA_START.test(raw);
  const text = guarded ? `'${raw}` : raw;
  return guarded || /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV of the rows exactly as the server sent them (decimal strings, no browser arithmetic). */
export function statementCsv(rows: readonly LossStatementRowView[]): string {
  const header = ['Date', 'Unit', 'Shift', 'Grain', 'Basis', 'Revision', ...CSV_FIGURES.map(([, label]) => label), 'Recovery verified', 'Unit of measure'];
  const lines = rows.map((row) => {
    const s = row.statement;
    return [row.localDate, row.unitName ?? row.unitId, row.shiftName ?? '', row.grain, row.basis ?? '', row.revisionState ?? 'none', ...CSV_FIGURES.map(([key]) => (s ? (s[key] as string | null) : null)), s ? (s.recoveryVerified ? 'yes' : 'no') : '', s?.uom ?? ''];
  });
  return [header, ...lines].map((line) => line.map(cell).join(',')).join('\n');
}

/** `source=event:<id>`: the page was opened from an event, so it links back to it. */
export function backEventOf(params: URLSearchParams): string | null {
  const source = params.get('source');
  return source?.startsWith('event:') ? source.slice('event:'.length) || null : null;
}

export interface StatementLinkTarget {
  unitId: string;
  utcStart: string;
  utcEnd: string;
  periodId: string;
  eventId?: string;
}

/**
 * The Accounting statement page on one period (Task 13 addendum 2, "View accounting"): its unit and window
 * as chosen dates, the row expanded and scrolled to (`focus`), and the event to go back to (`source`).
 */
export function statementHref(target: StatementLinkTarget): string {
  const params = new URLSearchParams({ from: target.utcStart, to: target.utcEnd, window: CHOSEN_DATES_KEY, units: target.unitId, focus: target.periodId });
  if (target.eventId) params.set('source', `event:${target.eventId}`);
  return `${STATEMENT_PATH}?${params}`;
}
