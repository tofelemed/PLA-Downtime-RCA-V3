import { CsvFormatError, readCsv } from '../profiles/csv-table';
import {
  CLASS_BOUND_KINDS,
  DICTIONARY_KINDS,
  DictionaryKind,
} from './failure-dictionary';

/** At most this many rows per dictionary import. */
export const MAX_DICTIONARY_ROWS = 5000;

/** One row as delivered (JSON body or CSV columns of the same names; CSV `assetTypes` is `;`-separated). */
export interface DictionaryRowInput {
  kind?: unknown;
  equipmentClass?: unknown;
  code?: unknown;
  name?: unknown;
  description?: unknown;
  category?: unknown;
  assetTypes?: unknown;
  isPending?: unknown;
}

/** The content of an entry (what an import compares and versions). */
export interface DictionaryDraft {
  kind: DictionaryKind;
  equipmentClass: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  assetTypes: string[];
  isPending: boolean;
}

export interface DictionaryRowError {
  line: number;
  message: string;
}

export interface ParsedDictionary {
  total: number;
  rows: Array<DictionaryDraft & { line: number }>;
  errors: DictionaryRowError[];
}

const text = (value: unknown, max: number): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed.slice(0, max);
};

function assetTypesOf(value: unknown): string[] | null {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(';')
      : null;
  if (!list || list.some((v) => typeof v !== 'string')) return null;
  return [...new Set((list as string[]).map((v) => v.trim()).filter(Boolean))];
}

function pendingOf(value: unknown): boolean | null {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const lower = String(value).trim().toLowerCase();
  if (['true', 'yes', '1'].includes(lower)) return true;
  return ['false', 'no', '0'].includes(lower) ? false : null;
}

/** One row → a draft, or the first problem found (codes ≤ 50, names ≤ 255 characters). */
export function parseDictionaryRow(
  row: DictionaryRowInput,
): DictionaryDraft | string {
  const kind = row.kind as DictionaryKind;
  if (!DICTIONARY_KINDS.includes(kind)) {
    return `kind must be one of ${DICTIONARY_KINDS.join(', ')}`;
  }
  const code = text(row.code, 50);
  const name = text(row.name, 255);
  if (!code || !name) return 'code and name are required';
  const equipmentClass = text(row.equipmentClass, 50) ?? '';
  if (equipmentClass && !CLASS_BOUND_KINDS.has(kind)) {
    return 'equipmentClass is only allowed on maintainable_item and failure_mode';
  }
  const assetTypes = assetTypesOf(row.assetTypes);
  if (assetTypes === null) return 'assetTypes must be a list of names';
  if (assetTypes.length > 0 && kind !== 'equipment_class') {
    return 'assetTypes is only allowed on equipment_class';
  }
  const isPending = pendingOf(row.isPending);
  if (isPending === null) return 'isPending must be true or false';
  return {
    kind,
    equipmentClass,
    code,
    name,
    description: text(row.description, 2000),
    category: text(row.category, 100),
    assetTypes,
    isPending,
  };
}

export const draftKey = (
  d: Pick<DictionaryDraft, 'kind' | 'equipmentClass' | 'code'>,
) => `${d.kind}|${d.equipmentClass}|${d.code}`;

function rawRows(input: {
  entries?: DictionaryRowInput[] | null;
  csv?: string | null;
}): Array<{ line: number; row: DictionaryRowInput }> {
  if (input.csv) {
    return readCsv(input.csv).map((r) => ({ line: r.line, row: r.values }));
  }
  return (input.entries ?? []).map((row, i) => ({ line: i + 1, row }));
}

/**
 * Validates an import document: every row well-formed, one row per kind + class + code, and every
 * class-bound row naming a class that is in the document or already in the dictionary (`knownClasses`).
 */
export function parseDictionaryImport(
  input: { entries?: DictionaryRowInput[] | null; csv?: string | null },
  knownClasses: ReadonlySet<string>,
): ParsedDictionary {
  let raw: Array<{ line: number; row: DictionaryRowInput }>;
  try {
    raw = rawRows(input);
  } catch (error: unknown) {
    if (!(error instanceof CsvFormatError)) throw error;
    return {
      total: 0,
      rows: [],
      errors: [{ line: 0, message: error.message }],
    };
  }
  if (raw.length === 0 || raw.length > MAX_DICTIONARY_ROWS) {
    const message = `an import holds 1 to ${MAX_DICTIONARY_ROWS} rows`;
    return { total: raw.length, rows: [], errors: [{ line: 0, message }] };
  }
  const parsed = raw.map(({ line, row }) => ({
    line,
    draft: parseDictionaryRow(row),
  }));
  const classes = new Set(knownClasses);
  for (const { draft } of parsed) {
    if (typeof draft !== 'string' && draft.kind === 'equipment_class')
      classes.add(draft.code);
  }
  return collect(parsed, classes, raw.length);
}

function collect(
  parsed: Array<{ line: number; draft: DictionaryDraft | string }>,
  classes: ReadonlySet<string>,
  total: number,
): ParsedDictionary {
  const rows: ParsedDictionary['rows'] = [];
  const errors: DictionaryRowError[] = [];
  const seen = new Set<string>();
  for (const { line, draft } of parsed) {
    if (typeof draft === 'string') {
      errors.push({ line, message: draft });
    } else if (seen.has(draftKey(draft))) {
      errors.push({
        line,
        message: `duplicate row for ${draft.kind} ${draft.code}`,
      });
    } else if (draft.equipmentClass && !classes.has(draft.equipmentClass)) {
      errors.push({
        line,
        message: `equipment class ${draft.equipmentClass} is not in the dictionary`,
      });
    } else {
      seen.add(draftKey(draft));
      rows.push({ ...draft, line });
    }
  }
  return { total, rows, errors };
}

/** True when the stored entry already says what the draft says (an import leaves it untouched). */
export function sameContent(a: DictionaryDraft, b: DictionaryDraft): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.category === b.category &&
    a.isPending === b.isPending &&
    [...a.assetTypes].sort().join(';') === [...b.assetTypes].sort().join(';')
  );
}
