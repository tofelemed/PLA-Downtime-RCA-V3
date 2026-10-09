import { RateTimebase } from '../actuals/actuals.types';
import { toDec } from '../actuals/decimal';
import { CsvFormatError, readCsv } from './csv-table';
import { RATE_TIMEBASES, Validity } from './profile.types';
import { isValidValidity, overlaps } from './version-window';

/** At most this many rows per import document. */
export const MAX_IMPORT_ROWS = 5000;

const INSTANT_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const MAX_CODE_LENGTH = 255;
const DEFAULT_MODE = 'normal';

/** One budget / forecast / MPC row as delivered (JSON body or CSV columns of the same names). */
export interface ImportRowInput {
  unitCode?: unknown;
  productCode?: unknown;
  operatingMode?: unknown;
  rate?: unknown;
  timebase?: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
}

export interface ParsedImportRow extends Validity {
  /** 1-based row (JSON) or CSV line */
  line: number;
  unitCode: string;
  productCode: string;
  operatingMode: string;
  rate: string;
  timebase: RateTimebase;
}

export interface ImportRowError {
  line: number;
  code: string;
  message: string;
}

export interface ParsedImport {
  /** rows delivered (valid or not) */
  total: number;
  rows: ParsedImportRow[];
  errors: ImportRowError[];
}

/**
 * Validates an import document (plan 2.2 step 4, PLAN06): every row complete and well-formed, rates
 * decimal (> 0 when `positive`), intervals half-open with an offset, and no two rows of one
 * unit/product/mode overlapping. References (codes, profiles, approved rates) are checked by the runner.
 */
export function parseImport(
  input: { rows?: ImportRowInput[] | null; csv?: string | null },
  positive: boolean,
): ParsedImport {
  let raw: Array<{ line: number; row: ImportRowInput }>;
  try {
    raw = input.csv
      ? readCsv(input.csv).map((r) => ({ line: r.line, row: r.values }))
      : (input.rows ?? []).map((row, i) => ({ line: i + 1, row }));
  } catch (error: unknown) {
    if (!(error instanceof CsvFormatError)) throw error;
    return {
      total: 0,
      rows: [],
      errors: [{ line: 0, code: 'invalid_csv', message: error.message }],
    };
  }
  if (raw.length === 0 || raw.length > MAX_IMPORT_ROWS) {
    const message = `an import holds 1 to ${MAX_IMPORT_ROWS} rows`;
    return {
      total: raw.length,
      rows: [],
      errors: [{ line: 0, code: 'row_count', message }],
    };
  }
  const rows: ParsedImportRow[] = [];
  const errors: ImportRowError[] = [];
  for (const { line, row } of raw) {
    const parsed = parseRow(line, row, positive);
    if ('code' in parsed) errors.push(parsed);
    else rows.push(parsed);
  }
  errors.push(...overlappingRows(rows));
  return { total: raw.length, rows, errors };
}

const INTERVAL_MESSAGE =
  'effectiveFrom/effectiveTo must be ISO instants with an offset, from < to';

function parseRow(
  line: number,
  row: ImportRowInput,
  positive: boolean,
): ParsedImportRow | ImportRowError {
  const fail = (code: string, message: string) => ({ line, code, message });
  const unitCode = code(row.unitCode);
  const productCode = code(row.productCode);
  if (!unitCode || !productCode) {
    return fail('missing_code', 'unitCode and productCode are required');
  }
  const rate = rateOf(row.rate, positive);
  if (rate === null) {
    return fail(
      'invalid_rate',
      `rate must be a decimal ${positive ? '> 0' : '≥ 0'}`,
    );
  }
  if (!(RATE_TIMEBASES as readonly unknown[]).includes(row.timebase)) {
    return fail(
      'invalid_timebase',
      `timebase must be one of ${RATE_TIMEBASES.join(', ')}`,
    );
  }
  const validity = validityOf(row);
  if (!validity) return fail('invalid_interval', INTERVAL_MESSAGE);
  const timebase = row.timebase as RateTimebase;
  const operatingMode = code(row.operatingMode) ?? DEFAULT_MODE;
  return {
    line,
    unitCode,
    productCode,
    operatingMode,
    rate,
    timebase,
    ...validity,
  };
}

/** Canonical decimal text of a rate ≥ 0 (> 0 when `positive`), else null. */
function rateOf(value: unknown, positive: boolean): string | null {
  const rate = toDec(
    typeof value === 'number' || typeof value === 'string' ? value : null,
  );
  if (rate === null || rate.isNegative() || (positive && rate.isZero())) {
    return null;
  }
  return rate.toFixed();
}

/** Half-open validity of a row; null when malformed or empty. */
function validityOf(row: ImportRowInput): Validity | null {
  const from = instant(row.effectiveFrom);
  const open =
    row.effectiveTo === undefined ||
    row.effectiveTo === null ||
    row.effectiveTo === '';
  const to = open ? null : instant(row.effectiveTo);
  if (!from || to === undefined || !isValidValidity({ from, to })) return null;
  return { from, to };
}

function code(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= MAX_CODE_LENGTH ? trimmed : null;
}

/** A Date for an ISO instant with offset; undefined when malformed. */
function instant(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !INSTANT_WITH_OFFSET.test(value))
    return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function overlappingRows(rows: readonly ParsedImportRow[]): ImportRowError[] {
  const byKey = new Map<string, ParsedImportRow[]>();
  for (const row of rows) {
    const key = `${row.unitCode}\u0000${row.productCode}\u0000${row.operatingMode}`;
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  const errors: ImportRowError[] = [];
  for (const group of byKey.values()) {
    const sorted = [...group].sort(
      (a, b) => a.from.getTime() - b.from.getTime(),
    );
    // the earlier row reaching furthest is the one a later row can overlap
    let reach = sorted[0];
    for (const row of sorted.slice(1)) {
      if (overlaps(reach, row)) {
        errors.push({
          line: row.line,
          code: 'overlapping_rows',
          message: `overlaps line ${reach.line} for the same unit, product and mode`,
        });
      }
      if (reach.to !== null && (row.to === null || row.to > reach.to))
        reach = row;
    }
  }
  return errors;
}
