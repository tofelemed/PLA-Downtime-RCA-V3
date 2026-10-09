/** A cell value: text, a decimal string, an integer, or empty (null). */
export type CsvValue = string | number | null;

/** A plain decimal number (`-12.5`, `0`): rendered as is, never treated as a formula. */
const DECIMAL = /^-?[0-9]+(\.[0-9]+)?$/;
/** Characters spreadsheets treat as the start of a formula (NFR02, OWASP CSV injection). */
const FORMULA_LEAD = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;

/** UTF-8 byte order mark, so spreadsheet tools read non-ASCII names (Persian unit names) correctly. */
export const CSV_BOM = String.fromCharCode(0xfeff);

/**
 * One RFC 4180 field. Text that a spreadsheet would evaluate (leading `=`, `+`, `-`, `@`, tab or CR) is
 * prefixed with `'` so it stays text; plain decimal numbers are left untouched (a negative quantity is a
 * number, not a formula). Fields with a quote, comma, line break or edge whitespace are quoted.
 */
export function csvCell(value: CsvValue): string {
  if (value === null) return '';
  let text = typeof value === 'number' ? String(value) : value;
  if (
    typeof value === 'string' &&
    !DECIMAL.test(text) &&
    FORMULA_LEAD.test(text)
  ) {
    text = `'${text}`;
  }
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One CSV record terminated by CRLF (RFC 4180). */
export function csvRow(values: readonly CsvValue[]): string {
  return `${values.map(csvCell).join(',')}\r\n`;
}
