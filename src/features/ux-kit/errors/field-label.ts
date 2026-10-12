import { humanize } from '../labels/humanize';
import { EVENT_FIELD_LABELS } from '../labels/event-labels';

function singular(word: string): string {
  if (/ies$/i.test(word)) return word.slice(0, -3) + 'y';
  if (/[^s]s$/i.test(word) && word.length > 3) return word.slice(0, -1);
  return word;
}

function keyLabel(key: string): string {
  const known = EVENT_FIELD_LABELS[key];
  if (known) return known;
  const withoutId = key.replace(/(?<=[a-z])Ids?$/, '');
  return humanize(withoutId || key);
}

/** One path segment: `lines[0]` → "Line 1", `quantity` → "Quantity", a bare `0` → "1". */
function segmentLabels(segment: string): string[] {
  const match = /^([^[\]]*)((?:\[\d+\])*)$/.exec(segment);
  if (!match) return [humanize(segment)];
  const [, name, indexes] = match;
  const numbers = [...indexes.matchAll(/\[(\d+)\]/g)].map((m) => String(Number(m[1]) + 1));
  if (/^\d+$/.test(name)) return [String(Number(name) + 1)];
  if (numbers.length === 0) return name ? [keyLabel(name)] : [];
  return [`${humanize(singular(name))} ${numbers.join('.')}`];
}

/**
 * Plain label of a server field path: `lines[0].quantity` → "Line 1 · Quantity", `slices.2.unitId` →
 * "Slice 3 · Unit", `validFrom` → "Valid from". Empty → "".
 */
export function fieldLabel(path: string): string {
  const parts: string[] = [];
  for (const segment of path.split('.').filter((s) => s !== '')) {
    const labels = segmentLabels(segment);
    const previous = parts.length - 1;
    if (labels.length === 1 && /^\d+$/.test(labels[0]) && previous >= 0) {
      parts[previous] = `${singularLabel(parts[previous])} ${labels[0]}`;
    } else {
      parts.push(...labels);
    }
  }
  return parts.join(' · ');
}

function singularLabel(label: string): string {
  const words = label.split(' ');
  words[words.length - 1] = singular(words[words.length - 1]);
  return words.join(' ');
}
