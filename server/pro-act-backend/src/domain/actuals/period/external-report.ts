import { CsvFormatError, readCsv } from '../../profiles/csv-table';
import { toDec } from '../decimal';

/** One unit/product line of an external daily-production record (ACT08). */
export interface ExternalReportLine {
  unitId: string;
  productId: string;
  gross: string | null;
  good: string | null;
  reject: string | null;
  uom: string | null;
}

/**
 * What the source itself reported for comparison (e.g. MQTT PLA feed: OT planned, actual, shortfall,
 * status, quality); kept on the record and shown, never used in accounting.
 */
export interface ExternalReportSourceFigures {
  planned?: number | null;
  actual?: number | null;
  shortfall?: number | null;
  uom?: string | null;
  status?: string | null;
  quality?: string | null;
  plant?: string | null;
  eventType?: string | null;
  topic?: string | null;
}

/** An external daily-production record as delivered (Maximo or similar, ACT08). */
export interface ExternalReportDraft {
  externalReportId: string;
  externalRevision: string;
  siteId: string | null;
  localProductionDate: string;
  timezone: string | null;
  utcStart: Date;
  utcEnd: Date;
  basis: 'gross' | 'good';
  sourceStatus: string;
  /** SME R13: the source system whose status mapping applies (null / absent = `import`) */
  sourceSystem?: string | null;
  approvedAtSource: Date | null;
  evidenceRef: string | null;
  lines: ExternalReportLine[];
  /** the source's own figures, for comparison only (null / absent = none) */
  sourceFigures?: ExternalReportSourceFigures | null;
  /** integration connection that delivered it (null / absent = API / file import) */
  connectionId?: string | null;
}

export interface DraftProblem {
  line: number | null;
  message: string;
}

/** The source system of an import without one (API / file import). */
export const IMPORT_SOURCE = 'import';

/**
 * SME R13: a source status is released (certified-eligible) only when the source's approved status mapping
 * names it as released (case-insensitive); an unmapped status, or no mapping at all, is not released.
 */
export function isReleasedStatus(
  status: string,
  mapping: ReadonlyArray<{ status: string; released: boolean }> | null,
): boolean {
  const wanted = status.trim().toUpperCase();
  return (mapping ?? []).some(
    (entry) => entry.released && entry.status.trim().toUpperCase() === wanted,
  );
}

/**
 * Order of two revisions of one report: numerically when both are numbers, else null (the caller then
 * orders by import time — a later import is the correction candidate).
 */
export function compareRevisions(a: string, b: string): number | null {
  const left = toDec(a);
  const right = toDec(b);
  if (!left || !right) return null;
  return left.comparedTo(right);
}

/** Semantic problems of one record; empty when it can be stored. */
export function draftProblems(draft: ExternalReportDraft): string[] {
  const problems: string[] = [];
  if (!(draft.utcStart.getTime() < draft.utcEnd.getTime())) {
    problems.push('utcStart must be before utcEnd');
  }
  if (draft.lines.length === 0)
    problems.push('a report needs at least one line');
  const keys = new Set<string>();
  draft.lines.forEach((line, index) => {
    const key = `${line.unitId}|${line.productId}`;
    if (keys.has(key))
      problems.push(`lines[${index}] repeats unit and product`);
    keys.add(key);
    const main = draft.basis === 'gross' ? line.gross : line.good;
    if (main === null)
      problems.push(`lines[${index}].${draft.basis} is required by the basis`);
    for (const [field, value] of Object.entries({
      gross: line.gross,
      good: line.good,
      reject: line.reject,
    })) {
      const parsed = toDec(value);
      if (value !== null && (!parsed || parsed.isNegative())) {
        problems.push(
          `lines[${index}].${field} must be a non-negative decimal`,
        );
      }
    }
  });
  return problems;
}

const REPORT_COLUMNS = [
  'externalReportId',
  'externalRevision',
  'localProductionDate',
  'utcStart',
  'utcEnd',
  'basis',
  'sourceStatus',
  'unitId',
  'productId',
] as const;

/**
 * CSV import (one row per line; rows of the same report id + revision form one record, header values
 * taken from the first row). Required columns: REPORT_COLUMNS; optional: siteId, timezone,
 * approvedAtSource, evidenceRef, sourceSystem, gross, good, reject, uom.
 */
export function reportsFromCsv(text: string): {
  reports: ExternalReportDraft[];
  problems: DraftProblem[];
} {
  let records: ReturnType<typeof readCsv>;
  try {
    records = readCsv(text);
  } catch (error: unknown) {
    const message =
      error instanceof CsvFormatError ? error.message : 'unreadable CSV';
    return { reports: [], problems: [{ line: null, message }] };
  }
  const problems: DraftProblem[] = [];
  const byKey = new Map<string, ExternalReportDraft>();
  for (const record of records) {
    const missing = REPORT_COLUMNS.filter((column) => !record.values[column]);
    if (missing.length > 0) {
      problems.push({
        line: record.line,
        message: `missing ${missing.join(', ')}`,
      });
      continue;
    }
    const row = rowOf(record.values, record.line, problems);
    if (!row) continue;
    const key = `${row.externalReportId}\u0000${row.externalRevision}`;
    const held = byKey.get(key);
    if (held) held.lines.push(...row.lines);
    else byKey.set(key, row);
  }
  return { reports: [...byKey.values()], problems };
}

function rowOf(
  values: Record<string, string>,
  line: number,
  problems: DraftProblem[],
): ExternalReportDraft | null {
  const utcStart = new Date(values.utcStart);
  const utcEnd = new Date(values.utcEnd);
  const approvedAt = values.approvedAtSource
    ? new Date(values.approvedAtSource)
    : null;
  const basis = values.basis.toLowerCase();
  const badTime = [utcStart, utcEnd, approvedAt].some(
    (value) => value !== null && Number.isNaN(value.getTime()),
  );
  if (badTime || (basis !== 'gross' && basis !== 'good')) {
    problems.push({ line, message: 'invalid time or basis (gross | good)' });
    return null;
  }
  const optional = (name: string) => values[name] || null;
  return {
    externalReportId: values.externalReportId,
    externalRevision: values.externalRevision,
    siteId: optional('siteId'),
    localProductionDate: values.localProductionDate,
    timezone: optional('timezone'),
    utcStart,
    utcEnd,
    basis,
    sourceStatus: values.sourceStatus,
    sourceSystem: optional('sourceSystem'),
    approvedAtSource: approvedAt,
    evidenceRef: optional('evidenceRef'),
    lines: [lineOf(values)],
  };
}

function lineOf(values: Record<string, string>): ExternalReportLine {
  const optional = (name: string) => values[name] || null;
  return {
    unitId: values.unitId,
    productId: values.productId,
    gross: optional('gross'),
    good: optional('good'),
    reject: optional('reject'),
    uom: optional('uom'),
  };
}
