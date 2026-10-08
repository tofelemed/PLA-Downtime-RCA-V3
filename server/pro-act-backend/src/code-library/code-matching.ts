/** A code as the resolver sees it: one row of a tenant's library. */
export interface CodeEntry {
  id: string;
  code: string;
  name: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
}

export type CodeMatch =
  | { status: 'resolved'; id: string }
  | { status: 'ambiguous'; candidates: string[] }
  | { status: 'unresolved'; suggestions: string[] };

const MAX_SUGGESTIONS = 3;

/**
 * Exact code resolution (spec ING03: no substring reason assignment): the value equals a code's `code`
 * or `name` case-insensitively, among the codes effective at `at`; a uuid must be the id of one of them.
 * Two different codes matching is ambiguous, never a pick. Unresolved values carry close codes as
 * suggestions for a human; suggestions are never assigned.
 */
export function matchCode(
  entries: readonly CodeEntry[],
  raw: string,
  at: Date,
): CodeMatch {
  const value = raw.trim().toLowerCase();
  const effective = entries.filter((entry) => isEffective(entry, at));
  const hits = effective.filter(
    (entry) =>
      entry.id.toLowerCase() === value ||
      entry.code.toLowerCase() === value ||
      entry.name.toLowerCase() === value,
  );
  const ids = [...new Set(hits.map((entry) => entry.id))];
  if (ids.length === 1) return { status: 'resolved', id: ids[0] };
  if (ids.length > 1) {
    return { status: 'ambiguous', candidates: hits.map((e) => e.code) };
  }
  return { status: 'unresolved', suggestions: suggest(effective, value) };
}

export function isEffective(
  entry: Pick<CodeEntry, 'effectiveFrom' | 'effectiveTo'>,
  at: Date,
): boolean {
  const time = at.getTime();
  return (
    (!entry.effectiveFrom || entry.effectiveFrom.getTime() <= time) &&
    (!entry.effectiveTo || entry.effectiveTo.getTime() > time)
  );
}

function suggest(entries: readonly CodeEntry[], value: string): string[] {
  const limit = Math.max(2, Math.floor(value.length / 3));
  return entries
    .map((entry) => ({
      code: entry.code,
      distance: Math.min(
        editDistance(entry.code.toLowerCase(), value),
        editDistance(entry.name.toLowerCase(), value),
      ),
    }))
    .filter((candidate) => candidate.distance <= limit)
    .sort((a, b) => a.distance - b.distance || a.code.localeCompare(b.code))
    .slice(0, MAX_SUGGESTIONS)
    .map((candidate) => candidate.code);
}

/** Levenshtein distance (two-row dynamic programme). */
export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length];
}
