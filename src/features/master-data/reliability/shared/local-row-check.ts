import type { CsvCheck } from '@/features/ux-kit/csv-import';
import { plural } from '@/features/ux-kit/format/plural';
import type { TextRow } from './delimited-rows';
import { mapPastedRows, type MappedRow } from './row-mapping';

/**
 * "Check" of an import the server cannot dry-run: the rows are read and shaped here, nothing is sent.
 * `count` formats the row count in the plant's digits.
 */
export function localRowCheck<T>(text: string, mapRow: (row: TextRow) => MappedRow<T>, count: (value: number) => string): CsvCheck {
  const mapped = mapPastedRows(text, mapRow);
  if (mapped.error) return { status: mapped.error, problems: [], ready: false };
  if (mapped.problems.length > 0) return { status: 'Fix the rows below first.', problems: mapped.problems, ready: false };
  return { status: `${plural(mapped.rows.length, 'row', 'rows', count)} ready to import.`, problems: [], ready: true };
}
