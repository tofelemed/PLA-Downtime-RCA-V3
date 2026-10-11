/**
 * Live classification of a raw token through a value map: the same lookup as the adapter
 * (`value-maps.ts`: exact token first, then case-insensitively when unambiguous; an unmapped token is
 * quarantined as `unmapped_value`, never defaulted). Display only — the server decides at intake.
 */
export type ValueMapKind = 'state' | 'reason';

export type Classification =
  | { outcome: 'mapped'; token: string; value: string; exact: boolean }
  | { outcome: 'passthrough'; token: string }
  | { outcome: 'unmapped'; token: string; reason: string; consequence: 'quarantined' | 'kept_raw' }
  | { outcome: 'no_token'; reason: string };

/** The lookup token of what the user typed: JSON number / boolean / `{ "name": ... }` or the text itself. */
export function tokenOfInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const number = Number(trimmed);
    return Number.isInteger(number) ? String(number) : null;
  }
  if (trimmed === 'true' || trimmed === 'false') return trimmed;
  if (trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const name = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>).name : undefined;
      return typeof name === 'string' ? name : null;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export interface ClassifyOptions {
  kind: ValueMapKind;
  /** `reasonUnmapped: keep` keeps an unmapped reason token (event created uncoded) */
  keepUnmappedReason?: boolean;
}

export function classifyToken(map: Readonly<Record<string, string>>, raw: string, options: ClassifyOptions): Classification {
  const token = tokenOfInput(raw);
  if (token === null) {
    return { outcome: 'no_token', reason: `${options.kind} value has no token form (fractions and objects without "name" are rejected)` };
  }
  if (Object.keys(map).length === 0) return { outcome: 'passthrough', token };
  if (map[token] !== undefined) return { outcome: 'mapped', token, value: map[token], exact: true };
  const folded = Object.keys(map).filter((key) => key.toLowerCase() === token.toLowerCase());
  if (folded.length === 1) return { outcome: 'mapped', token, value: map[folded[0]], exact: false };
  const reason = folded.length > 1 ? `"${token}" matches several map keys by case` : `"${token}" is not in valueMaps.${options.kind}`;
  const consequence = options.kind === 'reason' && options.keepUnmappedReason ? 'kept_raw' : 'quarantined';
  return { outcome: 'unmapped', token, reason, consequence };
}

export const REQUIRED_STATE_NAMES: readonly string[] = ['running', 'stopped'];
/** DT01 state names the design names (plan 1.10 vocabulary); the value is free text. */
export const STATE_NAME_SUGGESTIONS: readonly string[] = ['running', 'stopped', 'idle', 'reduced_rate', 'changeover', 'unknown'];

/** The problem with a state map, or null: once a map exists, running or stopped must be reachable. */
export function stateMapProblem(map: Readonly<Record<string, string>> | undefined): string | null {
  if (!map) return null;
  const targets = Object.values(map);
  if (targets.some((value) => REQUIRED_STATE_NAMES.includes(value))) return null;
  return `The state map must map at least one token to ${REQUIRED_STATE_NAMES.join(' or ')}; otherwise every state observation is quarantined`;
}
