import {
  PeriodFinding,
  RankedSourceRef,
  SliceActuals,
} from './period-actuals.types';

/** Which source gave a product's actuals in a run: the top rank, a substitute, or nothing. */
export interface AuthorityRole {
  role: 'primary' | 'fallback' | 'none';
  /** the substitute and the source it replaced (fallback only) */
  used: (RankedSourceRef & { label: string }) | null;
  replaced: RankedSourceRef | null;
  reason: string | null;
}

/** A slice of the run being written: its product and its actuals. */
export interface RunSlice {
  sliceId: string;
  productId: string;
  start: Date;
  /** what `roleOf` reads: the substitution flag, quantities and findings */
  actuals: Pick<SliceActuals, 'substitution' | 'gross' | 'good' | 'findings'>;
}

/**
 * Plan 1.10 step 5 / SRC01 fallback banner events: the authority switched to a substitute
 * (`activated`), or came back to the top-ranked source (`ended`). On return, a `source_conflict` of the
 * run (primary and substitute both quantified the window and differ beyond tolerance) is carried as the
 * reconciliation note: the primary is kept, the conflict is logged — never summed or averaged.
 */
export interface AuthorityTransition {
  kind: 'activated' | 'ended';
  sliceId: string;
  productId: string;
  used: (RankedSourceRef & { label: string }) | null;
  replaced: RankedSourceRef | null;
  reason: string | null;
  conflict: Record<string, unknown> | null;
}

/** The role of one slice's actuals (SME E7 substitution flag; no quantity = no source). */
export function roleOf(actuals: RunSlice['actuals']): AuthorityRole {
  const substitution = actuals.substitution ?? null;
  if (substitution) {
    return {
      role: 'fallback',
      used: substitution.used,
      replaced: substitution.replaced,
      reason: substitution.reason,
    };
  }
  const quantified = actuals.gross !== null || actuals.good !== null;
  return {
    role: quantified ? 'primary' : 'none',
    used: null,
    replaced: null,
    reason: null,
  };
}

const conflictOf = (findings: readonly PeriodFinding[]) =>
  findings.find((f) => f.code === 'source_conflict')?.detail ?? null;

const byStart = (a: RunSlice, b: RunSlice) =>
  a.start.getTime() - b.start.getTime() || a.sliceId.localeCompare(b.sliceId);

/**
 * Transitions of a run in time order, starting from each product's role at the end of the preceding period
 * of the unit (its last slice there) and carried from slice to slice: a product moving to a substitute
 * (also with no earlier role) is `activated`; a product back on the top rank after a substitute is
 * `ended`. A slice without data changes nothing. Pure; deterministic.
 */
export function authorityTransitions(
  preceding: ReadonlyMap<string, AuthorityRole>,
  slices: readonly RunSlice[],
): AuthorityTransition[] {
  const carried = new Map(preceding);
  const transitions: AuthorityTransition[] = [];
  for (const slice of [...slices].sort(byStart)) {
    const now = roleOf(slice.actuals);
    if (now.role === 'none') continue;
    const before = carried.get(slice.productId) ?? null;
    carried.set(slice.productId, now);
    const activated = now.role === 'fallback' && before?.role !== 'fallback';
    const ended = now.role === 'primary' && before?.role === 'fallback';
    if (!activated && !ended) continue;
    const from = activated ? now : (before as AuthorityRole);
    transitions.push({
      kind: activated ? 'activated' : 'ended',
      sliceId: slice.sliceId,
      productId: slice.productId,
      used: from.used,
      replaced: from.replaced,
      reason: from.reason,
      conflict: ended ? conflictOf(slice.actuals.findings) : null,
    });
  }
  return transitions;
}

const keyOf = (t: AuthorityTransition) =>
  [t.kind, t.sliceId, t.used?.rank ?? '', t.used?.source ?? ''].join('|');

/**
 * What a recalculation newly says: the transitions of the new run that the run it supersedes (same
 * period, same preceding roles) did not already have — so a rerun with the same outcome publishes nothing —
 * and, for a substitute the earlier run announced that the new run no longer uses (late primary data), its
 * end, so a banner never stays up for a fallback that is gone.
 */
export function newTransitions(
  current: readonly AuthorityTransition[],
  previous: readonly AuthorityTransition[],
): AuthorityTransition[] {
  const known = new Set(previous.map(keyOf));
  const now = new Set(current.map(keyOf));
  const withdrawn = previous
    .filter((t) => t.kind === 'activated' && !now.has(keyOf(t)))
    .map((t) => ({ ...t, kind: 'ended' as const, conflict: null }))
    .filter((t) => !now.has(keyOf(t)));
  return [...current.filter((t) => !known.has(keyOf(t))), ...withdrawn];
}
