const LABEL = /[A-Z]/g;
const labelOfKey = (key: string) => key.replace(LABEL, (letter) => ` ${letter.toLowerCase()}`).replace(/^./, (first) => first.toUpperCase());

function collect(value: unknown, key: string, lines: string[]): void {
  if (typeof value === 'string') {
    if (value.trim() !== '' && key !== 'id' && !key.endsWith('Id')) lines.push(`${labelOfKey(key)}: ${value.trim()}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collect(item, key, lines));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([childKey, child]) => collect(child, childKey, lines));
  }
}

/** The words a person typed into a tool record, one "Field: text" line each (for "keep my text" on a conflict). */
export function draftText(content: unknown): string {
  const lines: string[] = [];
  collect(content, 'text', lines);
  return lines.join('\n');
}
