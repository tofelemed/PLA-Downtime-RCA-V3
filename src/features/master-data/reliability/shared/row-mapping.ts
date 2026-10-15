import { V2ApiError } from '@/api/v2/errors';
import { isZonedInstant, parseDelimitedRows, type TextRow } from './delimited-rows';

/** A problem of one data row; `line` is the row number (1 = first data row), as the server counts it. */
export interface RowProblem {
  line: number;
  message: string;
}

export interface MappedRow<T> {
  value: T;
  problems: string[];
}

export interface MappedRows<T> {
  rows: T[];
  problems: RowProblem[];
  /** the text could not be read at all */
  error: string | null;
}

/** Text rows → API rows; every row's shaping problems, numbered as the server numbers its own. */
export function mapPastedRows<T>(text: string, mapOne: (row: TextRow) => MappedRow<T>): MappedRows<T> {
  const parsed = parseDelimitedRows(text);
  if (parsed.error) return { rows: [], problems: [], error: parsed.error };
  const mapped = parsed.rows.map(mapOne);
  return {
    rows: mapped.map((m) => m.value),
    problems: mapped.flatMap((m, i) => m.problems.map((message) => ({ line: i + 1, message }))),
    error: null,
  };
}

/** Problems of a required choice column (`kind`, `outcome`). */
export function choiceProblem(row: TextRow, column: string, allowed: readonly string[]): string[] {
  return allowed.includes(row[column] ?? '') ? [] : [`${column} must be one of ${allowed.join(', ')}`];
}

/** Problems of an instant column (required or optional). */
export function instantProblem(row: TextRow, column: string, required: boolean): string[] {
  const value = row[column] ?? '';
  if (!value) return required ? [`${column} is required`] : [];
  return isZonedInstant(value) ? [] : [`${column} must be an ISO 8601 time with its offset, e.g. 2026-10-01T08:00:00Z`];
}

/** Row problems of a 422 import refusal (`details.errors`); empty for any other failure. */
export function serverRowProblems(error: unknown): RowProblem[] {
  if (!(error instanceof V2ApiError)) return [];
  const errors = error.details?.errors;
  if (!Array.isArray(errors)) return [];
  return errors.filter((e): e is RowProblem => typeof e === 'object' && e !== null && 'line' in e && 'message' in e);
}
