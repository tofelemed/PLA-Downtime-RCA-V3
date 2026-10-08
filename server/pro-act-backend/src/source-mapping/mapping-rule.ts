/**
 * Source mapping vocabulary and normalisation (spec ING03, plan 1.3).
 *
 * - `exact_id`: the source's own id (PI WebId, topic, ...), compared exactly after trimming.
 * - `exact_path`: a hierarchical path. `\` and `/` are both separators; runs of separators collapse to one
 *   `/`, leading/trailing separators and whitespace are dropped, and the result is lower-cased (AF paths are
 *   case-insensitive). `\\AF\Plant\Unit100` and `af/plant/unit100/` are the same path.
 * - `pattern`: a glob over the normalised path (or the source id when no path is supplied), normalised
 *   like a path. `*` matches any run of characters (separators included), `?` exactly one character;
 *   `[*]`, `[?]` and `[[]` match a literal `*`, `?`, `[`. Backslashes are separators, never escapes.
 * - `af_binding`: a PI AF element WebId, compared exactly (also read from `af_bindings`).
 */
export const MATCH_KINDS = [
  'exact_id',
  'exact_path',
  'pattern',
  'af_binding',
] as const;
export type MatchKind = (typeof MATCH_KINDS)[number];

export const MAPPING_TARGET_TYPES = ['unit', 'asset'] as const;
export type MappingTargetType = (typeof MAPPING_TARGET_TYPES)[number];

/** One rule as the resolver sees it (from `source_mappings` or `af_bindings`). */
export interface MappingRule {
  id: string;
  kind: MatchKind;
  normalizedValue: string;
  precedence: number;
  /** null = any connection; a rule for the caller's connection beats an "any" rule */
  connectionId: string | null;
  targetType: MappingTargetType;
  targetId: string;
  version: number;
  origin: 'source_mapping' | 'af_binding';
}

export function normalizePath(raw: string): string {
  return raw
    .trim()
    .replace(/[\\/]+/g, '/')
    .replace(/^\/|\/$/g, '')
    .toLowerCase();
}

export function normalizeSourceId(raw: string): string {
  return raw.trim();
}

/** The value resolution compares for a rule of `kind`. */
export function normalizeMatchValue(kind: MatchKind, raw: string): string {
  return kind === 'exact_path' || kind === 'pattern'
    ? normalizePath(raw)
    : normalizeSourceId(raw);
}

const LITERAL_TOKENS: ReadonlyArray<[token: string, regex: string]> = [
  ['[*]', '\\*'],
  ['[?]', '\\?'],
  ['[[]', '\\['],
];

/** Anchored, case-insensitive regular expression of a normalised glob pattern. */
export function compileGlob(normalizedPattern: string): RegExp {
  let body = '';
  let index = 0;
  while (index < normalizedPattern.length) {
    const literal = LITERAL_TOKENS.find(([token]) =>
      normalizedPattern.startsWith(token, index),
    );
    if (literal) {
      body += literal[1];
      index += literal[0].length;
      continue;
    }
    body += globChar(normalizedPattern[index]);
    index += 1;
  }
  return new RegExp(`^${body}$`, 'i');
}

function globChar(char: string): string {
  if (char === '*') return '.*';
  if (char === '?') return '.';
  return char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}
