import { humanize } from '../labels/humanize';

/** How one form names a server field: its own label and the labels of its choices (enum value → label). */
export interface FieldVocabularyEntry {
  label?: string;
  values?: Readonly<Record<string, string>>;
}

/**
 * A form's words for the server's field paths (owner manual test: the refusal said "Default basis" where the
 * form says "Default management view", and listed raw enum keys). Keyed by the server path or its root
 * property (`defaultBasis`, `lines`); a field the form does not name falls back to the humanized path.
 */
export type FieldVocabulary = Readonly<Record<string, FieldVocabularyEntry>>;

export function vocabularyEntry(vocabulary: FieldVocabulary | undefined, path: string): FieldVocabularyEntry | undefined {
  if (!vocabulary) return undefined;
  return vocabulary[path] ?? vocabulary[path.split(/[.[]/)[0]];
}

/** class-validator `IsIn` / `IsEnum`: "must be one of the following values: a, b, c". */
const ONE_OF = /^must be one of the following values:\s*(.*)$/i;

/** "Must be one of: Economic impact, Contribution margin" — the form's choice labels, else humanized keys. */
export function humanizeEnumMessage(message: string, values?: Readonly<Record<string, string>>): string | null {
  const match = ONE_OF.exec(message.trim());
  if (!match) return null;
  const choices = match[1]
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '')
    .map((value) => values?.[value] ?? humanize(value));
  return choices.length > 0 ? `Must be one of: ${choices.join(', ')}` : 'Is not one of the allowed choices';
}
