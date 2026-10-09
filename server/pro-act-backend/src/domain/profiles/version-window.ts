import { Validity, VersionRef } from './profile.types';

/**
 * Effective-dated versions (plan 2.2): validity is half-open `[from, to)`, approved versions of one key
 * never overlap, and a new version may supersede its predecessor by closing the predecessor exactly at
 * the new `from`. Pure; the services lock and persist.
 */

function endMs(validity: Validity): number {
  return validity.to ? validity.to.getTime() : Number.POSITIVE_INFINITY;
}

export function overlaps(a: Validity, b: Validity): boolean {
  return a.from.getTime() < endMs(b) && b.from.getTime() < endMs(a);
}

export function covers(validity: Validity, at: Date): boolean {
  const t = at.getTime();
  return validity.from.getTime() <= t && t < endMs(validity);
}

export function isValidValidity(validity: Validity): boolean {
  return (
    validity.to === null || validity.to.getTime() > validity.from.getTime()
  );
}

/** The version in force at `at` (the highest version number when, against the rules, several are). */
export function versionAt<T extends VersionRef>(
  versions: readonly T[],
  at: Date,
): T | null {
  return versions
    .filter((version) => covers(version, at))
    .reduce<T | null>(
      (best, version) =>
        !best || version.version > best.version ? version : best,
      null,
    );
}

export interface ApprovalPlan {
  /** the predecessor closed at the candidate's `from` */
  supersede: { id: string; version: number; effectiveTo: Date } | null;
  /** approved versions that would still overlap: approval is refused (409) */
  conflicts: VersionRef[];
}

/**
 * What approving `candidate` does to the approved versions of its key. Without `supersede` any overlap
 * is a conflict. With it, the one version that starts strictly before the candidate and would end
 * inside it (or the candidate is open-ended) is closed at the candidate's `from`; anything else that
 * overlaps stays a conflict — a supersede never shortens a version beyond what the candidate replaces.
 */
export function planApproval(
  candidate: Validity,
  approved: readonly VersionRef[],
  supersede: boolean,
): ApprovalPlan {
  const overlapping = approved.filter((version) =>
    overlaps(version, candidate),
  );
  const predecessor = supersede
    ? overlapping.find(
        (version) =>
          version.from.getTime() < candidate.from.getTime() &&
          endMs(version) <= endMs(candidate),
      )
    : undefined;
  return {
    supersede: predecessor
      ? {
          id: predecessor.id,
          version: predecessor.version,
          effectiveTo: candidate.from,
        }
      : null,
    conflicts: overlapping.filter((version) => version !== predecessor),
  };
}

export interface VersionSegment<T> {
  from: Date;
  to: Date;
  /** null where no version is in force */
  version: T | null;
}

/**
 * Splits `[from, to)` at every version boundary (T30: a stop across a rate change is two segments,
 * each valued at its own version). Adjacent pieces of one version are merged.
 */
export function segmentsByVersion<T extends VersionRef>(
  versions: readonly T[],
  window: { from: Date; to: Date },
): Array<VersionSegment<T>> {
  const start = window.from.getTime();
  const end = window.to.getTime();
  if (!(end > start)) return [];
  const cuts = new Set<number>([start, end]);
  for (const version of versions) {
    for (const t of [version.from.getTime(), endMs(version)]) {
      if (t > start && t < end) cuts.add(t);
    }
  }
  const sorted = [...cuts].sort((a, b) => a - b);
  const segments: Array<VersionSegment<T>> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const version = versionAt(versions, new Date(sorted[i]));
    const last = segments[segments.length - 1];
    if (last && last.version === version) {
      last.to = new Date(sorted[i + 1]);
      continue;
    }
    segments.push({
      from: new Date(sorted[i]),
      to: new Date(sorted[i + 1]),
      version,
    });
  }
  return segments;
}
