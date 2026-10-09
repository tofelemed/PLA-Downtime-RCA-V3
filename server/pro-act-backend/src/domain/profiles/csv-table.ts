/**
 * Minimal RFC 4180 reader for rate imports: comma separated, `"` quoting with `""` escapes, CRLF or LF
 * line ends, blank lines skipped. The first record is the header. Returns records as header → value maps
 * with their 1-based line number (header = line 1).
 */
export interface CsvRecord {
  line: number;
  values: Record<string, string>;
}

export class CsvFormatError extends Error {}

export function readCsv(text: string): CsvRecord[] {
  const records = splitRecords(text);
  const header = records.shift();
  if (!header) return [];
  const names = header.fields.map((name) => name.trim());
  return records.map((record) => ({
    line: record.line,
    values: Object.fromEntries(
      names.map((name, i) => [name, (record.fields[i] ?? '').trim()]),
    ),
  }));
}

interface RawRecord {
  line: number;
  fields: string[];
}

function splitRecords(text: string): RawRecord[] {
  const records: RawRecord[] = [];
  const state = { fields: [] as string[], field: '', quoted: false };
  let line = 1;
  let startLine = 1;
  const endRecord = () => {
    state.fields.push(state.field);
    if (state.fields.some((field) => field.trim() !== '')) {
      records.push({ line: startLine, fields: state.fields });
    }
    state.fields = [];
    state.field = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (state.quoted) {
      if (ch === '\n') line++;
      i += quotedChar(state, ch, text[i + 1]) - 1;
      continue;
    }
    if (ch === '"') state.quoted = true;
    else if (ch === ',') {
      state.fields.push(state.field);
      state.field = '';
    } else if (ch === '\n') {
      endRecord();
      line++;
      startLine = line;
    } else if (ch !== '\r') state.field += ch;
  }
  if (state.quoted) throw new CsvFormatError('unterminated quoted field');
  endRecord();
  return records;
}

/** One character inside quotes: `""` is an escaped quote, `"` closes; returns characters consumed. */
function quotedChar(
  state: { field: string; quoted: boolean },
  ch: string,
  next: string | undefined,
): number {
  if (ch === '"' && next === '"') {
    state.field += '"';
    return 2;
  }
  if (ch === '"') state.quoted = false;
  else state.field += ch;
  return 1;
}
