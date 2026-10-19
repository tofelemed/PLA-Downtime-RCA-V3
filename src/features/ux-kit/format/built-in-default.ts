/**
 * Built-in defaults (QA M1, M7): the server seeds a plant's first version of a policy at the Unix epoch
 * ("in force from the start") with an internal note. Screens show plain words instead of
 * "1970-01-01 03:30" and the decision references.
 */
export const BUILT_IN_DEFAULT_START = 'Built-in default (from the start)';

export const BUILT_IN_DEFAULT_NOTE = 'Built-in default; change it by recording a new version.';

/** Instants up to this one are the epoch sentinel (any zone offset of 1970-01-01 00:00 UTC). */
const SENTINEL_LIMIT_MS = Date.UTC(1970, 0, 2);

/** Whether `iso` is the epoch sentinel of a seeded default version (≤ 1970-01-02 UTC). */
export function isBuiltInDefaultStart(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && ms <= SENTINEL_LIMIT_MS;
}

/** `format(iso)`, or "Built-in default (from the start)" for the epoch sentinel. */
export function effectiveFromText(iso: string | null | undefined, format: (iso: string | null | undefined) => string): string {
  return isBuiltInDefaultStart(iso) ? BUILT_IN_DEFAULT_START : format(iso);
}

/** "since <time>" for a real start; the default label alone for the sentinel. */
export function sinceText(iso: string | null | undefined, format: (iso: string | null | undefined) => string): string {
  return isBuiltInDefaultStart(iso) ? BUILT_IN_DEFAULT_START : `since ${format(iso)}`;
}

/** Notes written by the server or a migration when it seeded a default version. */
const SEED_NOTE = /^Seeded (on first use|by migration)\b/;

/** Whether `note` is the internal seed note of a built-in default. */
export const isSeedNote = (note: string | null | undefined): boolean => Boolean(note && SEED_NOTE.test(note.trim()));

/** A version's note for display: the internal seed notes read as plain words; other notes as written. */
export function policyNoteText(note: string | null | undefined): string | null {
  if (!note) return null;
  return isSeedNote(note) ? BUILT_IN_DEFAULT_NOTE : note;
}
