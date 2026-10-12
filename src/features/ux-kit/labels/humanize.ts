/**
 * Plain-language text for internal tokens (docs/UI_UX_AUDIT.md §6): enum values, keys and codes are never
 * shown as sent. `humanize` is the last resort; prefer an explicit label map with `labelOf`.
 */

/** Words always written in capitals. */
const ACRONYMS: ReadonlySet<string> = new Set([
  'oee', 'rca', 'fx', 'uom', 'kpi', 'pi', 'mqtt', 'api', 'csv', 'pla', 'opc', 'ua', 'url', 'tls', 'dst', 'utc',
  'cmms', 'ok', 'id', 'json', 'http', 'sql', 'erp', 'mes', 'iso',
]);

/** Splits `snake_case`, `kebab-case`, `dot.case`, `camelCase` and `PascalCase` into words. */
function wordsOf(token: string): string[] {
  return token
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_.\-/]+/)
    .filter((word) => word.length > 0);
}

function wordText(word: string, index: number): string {
  const lower = word.toLowerCase();
  if (ACRONYMS.has(lower)) return lower.toUpperCase();
  if (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) return word;
  return index === 0 ? capitalize(lower) : lower;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Sentence-case text of a token: `complete_inputs` → "Complete inputs", `camelCaseKey` → "Camel case key",
 * `oee_policy` → "OEE policy", `UOM_MIXED` → "UOM mixed". Known acronyms and all-caps words inside a
 * mixed-case token (`totalOEE`) stay in capitals. Empty → "".
 */
export function humanize(token: string): string {
  const screaming = !/[a-z]/.test(token);
  return wordsOf(screaming ? token.toLowerCase() : token)
    .map((word, index) => wordText(word, index))
    .join(' ');
}

/**
 * Label of `value` from `map`; never the raw token: an unknown value is humanized, null / undefined / ""
 * gives `fallback` (default "—").
 */
export function labelOf<K extends string>(
  map: Readonly<Record<K, string>>,
  value: string | null | undefined,
  fallback?: string,
): string {
  if (value === null || value === undefined || value === '') return fallback ?? '—';
  if (Object.prototype.hasOwnProperty.call(map, value)) return map[value as K];
  return humanize(value) || (fallback ?? '—');
}
