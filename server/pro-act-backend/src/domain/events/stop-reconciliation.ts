import { SourceKind } from './event-classification';

/**
 * Cause fields a duplicate can contribute to the stop that is kept (plan 1.10 source authority): the
 * reason, the asset (a derived unit-level stop learns which asset stopped), codes, origin and failure
 * detail. Timing never moves between sources: the kept stop's start and end stay its own.
 */
export const CAUSE_FIELDS = [
  'reasonCodeId',
  'assetId',
  'impactCodeId',
  'oeeCodeId',
  'originUnitId',
  'originAssetId',
  'failureMode',
  'failureSeverity',
  'maintainableItem',
  'failureMechanism',
  'failureCause',
  'detectionMethod',
  'workOrderId',
] as const;
export type CauseField = (typeof CAUSE_FIELDS)[number];
export type CauseValues = Partial<Record<CauseField, string | null>>;

/**
 * Timing authority (plan 1.10 SRC02: primary timing = derived state if present, else the source event):
 * the state engine's sample times, then a connector's event frame, then an import, then a person's entry.
 */
const TIMING_RANK: Readonly<Record<SourceKind, number>> = {
  derived: 3,
  source: 2,
  imported: 1,
  manual: 0,
};

/** Cause authority: the operator who saw the stop, then the source's coding, then an import, then none. */
const CAUSE_RANK: Readonly<Record<SourceKind, number>> = {
  manual: 3,
  source: 2,
  imported: 1,
  derived: 0,
};

/** A live downtime event of one unit as the reconciler sees it. */
export interface ReconcilableStop {
  id: string;
  unitId: string;
  assetId: string | null;
  sourceKind: SourceKind;
  start: Date;
  /** null = open */
  end: Date | null;
  createdAt: Date;
  cause: CauseValues;
}

export type PairMode = 'auto' | 'suggested';
/** why a pair is only suggested (null for an automatic merge) */
export type SuggestionReason = 'same_source' | 'cause_conflict' | 'ambiguous';

export interface ReconciliationPair {
  keptId: string;
  evidenceId: string;
  mode: PairMode;
  suggestionReason: SuggestionReason | null;
  startDeltaSeconds: number;
  /** null when either stop is open */
  endDeltaSeconds: number | null;
  /** cause fields where both carry different values (cause_conflict) */
  conflicts: CauseField[];
  /** cause values the evidence fills in on the kept stop (empty fields only; auto pairs) */
  copied: CauseValues;
}

export interface ReconciliationOptions {
  toleranceSeconds: number;
  /** `keptId|evidenceId` pairs a person rejected or undid: never proposed again */
  blocked: ReadonlySet<string>;
}

export const pairKey = (keptId: string, evidenceId: string) =>
  `${keptId}|${evidenceId}`;

interface Match {
  startDeltaSeconds: number;
  endDeltaSeconds: number | null;
}

/**
 * Same stop recorded twice: same unit, the same asset (or one of them unit-level), overlapping, start
 * within the tolerance and — when both are closed — end within the tolerance.
 */
export function matchOf(
  a: ReconcilableStop,
  b: ReconcilableStop,
  toleranceSeconds: number,
): Match | null {
  if (a.unitId !== b.unitId) return null;
  if (a.assetId && b.assetId && a.assetId !== b.assetId) return null;
  const aEnd = a.end?.getTime() ?? Number.POSITIVE_INFINITY;
  const bEnd = b.end?.getTime() ?? Number.POSITIVE_INFINITY;
  const overlap = a.start.getTime() < bEnd && b.start.getTime() < aEnd;
  if (!overlap) return null;
  const startDelta = Math.abs(a.start.getTime() - b.start.getTime()) / 1000;
  if (startDelta > toleranceSeconds) return null;
  if (!a.end || !b.end) {
    return { startDeltaSeconds: startDelta, endDeltaSeconds: null };
  }
  const endDelta = Math.abs(aEnd - bEnd) / 1000;
  return endDelta > toleranceSeconds
    ? null
    : { startDeltaSeconds: startDelta, endDeltaSeconds: endDelta };
}

/** Earlier timing authority first; same kind → the one recorded first; then id. */
function outranks(a: ReconcilableStop, b: ReconcilableStop): boolean {
  const rank = TIMING_RANK[a.sourceKind] - TIMING_RANK[b.sourceKind];
  if (rank !== 0) return rank > 0;
  const created = a.createdAt.getTime() - b.createdAt.getTime();
  if (created !== 0) return created < 0;
  return a.id < b.id;
}

interface Candidate {
  kept: ReconcilableStop;
  match: Match;
}

function candidatesOf(
  evidence: ReconcilableStop,
  stops: readonly ReconcilableStop[],
  options: ReconciliationOptions,
): Candidate[] {
  return stops.flatMap((kept) => {
    if (kept.id === evidence.id || !outranks(kept, evidence)) return [];
    if (options.blocked.has(pairKey(kept.id, evidence.id))) return [];
    const match = matchOf(kept, evidence, options.toleranceSeconds);
    return match ? [{ kept, match }] : [];
  });
}

/** Candidates of the best timing rank; more than one = ambiguous. */
function bestCandidates(candidates: readonly Candidate[]): Candidate[] {
  const best = Math.max(
    ...candidates.map((c) => TIMING_RANK[c.kept.sourceKind]),
  );
  return candidates.filter((c) => TIMING_RANK[c.kept.sourceKind] === best);
}

function conflictsOf(kept: CauseValues, evidence: CauseValues): CauseField[] {
  return CAUSE_FIELDS.filter(
    (field) =>
      field !== 'assetId' &&
      (kept[field] ?? null) !== null &&
      (evidence[field] ?? null) !== null &&
      kept[field] !== evidence[field],
  );
}

function fillsOf(kept: CauseValues, evidence: CauseValues): CauseValues {
  const copied: CauseValues = {};
  for (const field of CAUSE_FIELDS) {
    const value = evidence[field] ?? null;
    if ((kept[field] ?? null) === null && value !== null) copied[field] = value;
  }
  return copied;
}

/** The stop's cause values with its asset (a cause field like the others). */
const causeOf = (stop: ReconcilableStop): CauseValues => ({
  ...stop.cause,
  assetId: stop.assetId,
});

const byCauseAuthority = (a: ReconcilableStop, b: ReconcilableStop) =>
  CAUSE_RANK[b.sourceKind] - CAUSE_RANK[a.sourceKind] ||
  a.createdAt.getTime() - b.createdAt.getTime() ||
  a.id.localeCompare(b.id);

/**
 * DT-04 / SME D5 duplicate merge and plan 1.10 SRC02 source authority over the live stops of one unit:
 * each stop recorded twice is paired with the stop of the best timing authority it matches (derived state
 * → source frame → import → manual). A pair merges automatically when the sources differ, the match is
 * unique and the causes agree; same-source pairs, cause conflicts and several equally ranked candidates
 * are only suggested to a person. The kept stop keeps its own timing; evidence fills its empty cause
 * fields in cause-authority order (operator → source → import), so nothing is counted twice and no
 * explanation is lost. A chain (manual → source → derived) ends at the top stop. Deterministic for any
 * input order.
 */
export function planReconciliation(
  stops: readonly ReconcilableStop[],
  options: ReconciliationOptions,
): ReconciliationPair[] {
  const sorted = [...stops].sort((a, b) => (outranks(a, b) ? -1 : 1));
  const keptOf = new Map<string, string>();
  const byId = new Map(sorted.map((s) => [s.id, s]));
  const pairs: ReconciliationPair[] = [];
  const linked: Array<{ candidate: Candidate; evidence: ReconcilableStop }> =
    [];
  // a kept stop outranks its evidence, so its own fate is decided before its evidence is visited
  for (const evidence of sorted) {
    const candidates = candidatesOf(evidence, sorted, options);
    if (candidates.length === 0) continue;
    const best = bestCandidates(candidates);
    if (best.length > 1) {
      pairs.push(...best.map((c) => suggestion(c, evidence, 'ambiguous', [])));
      continue;
    }
    const kept = byId.get(rootOf(best[0].kept.id, keptOf)) as ReconcilableStop;
    const candidate = { kept, match: best[0].match };
    const conflicts = conflictsOf(causeOf(kept), causeOf(evidence));
    if (kept.sourceKind === evidence.sourceKind) {
      pairs.push(suggestion(candidate, evidence, 'same_source', conflicts));
    } else if (conflicts.length > 0) {
      pairs.push(suggestion(candidate, evidence, 'cause_conflict', conflicts));
    } else {
      keptOf.set(evidence.id, kept.id);
      linked.push({ candidate, evidence });
    }
  }
  pairs.push(...autoPairs(linked));
  return pairs.sort((a, b) =>
    pairKey(a.keptId, a.evidenceId).localeCompare(
      pairKey(b.keptId, b.evidenceId),
    ),
  );
}

/**
 * Automatic pairs with the cause values each evidence fills in: per kept stop, evidence in cause-authority
 * order fills the fields still empty (a lower-authority value for a filled field stays on its evidence).
 */
function autoPairs(
  linked: ReadonlyArray<{ candidate: Candidate; evidence: ReconcilableStop }>,
): ReconciliationPair[] {
  const effective = new Map<string, CauseValues>();
  return [...linked]
    .sort((a, b) => byCauseAuthority(a.evidence, b.evidence))
    .map(({ candidate, evidence }): ReconciliationPair => {
      const keptId = candidate.kept.id;
      const cause = effective.get(keptId) ?? causeOf(candidate.kept);
      effective.set(keptId, cause);
      // another asset than the one an earlier evidence named is another stop: a person decides
      if (
        cause.assetId &&
        evidence.assetId &&
        cause.assetId !== evidence.assetId
      ) {
        return suggestion(candidate, evidence, 'cause_conflict', ['assetId']);
      }
      const copied = fillsOf(cause, causeOf(evidence));
      Object.assign(cause, copied);
      return { ...pairOf(candidate, evidence), mode: 'auto', copied };
    });
}

function rootOf(id: string, keptOf: ReadonlyMap<string, string>): string {
  let root = id;
  const seen = new Set<string>();
  while (keptOf.has(root) && !seen.has(root)) {
    seen.add(root);
    root = keptOf.get(root) as string;
  }
  return root;
}

function pairOf(candidate: Candidate, evidence: ReconcilableStop) {
  return {
    keptId: candidate.kept.id,
    evidenceId: evidence.id,
    suggestionReason: null,
    startDeltaSeconds: candidate.match.startDeltaSeconds,
    endDeltaSeconds: candidate.match.endDeltaSeconds,
    conflicts: [] as CauseField[],
  };
}

function suggestion(
  candidate: Candidate,
  evidence: ReconcilableStop,
  reason: SuggestionReason,
  conflicts: CauseField[],
): ReconciliationPair {
  return {
    ...pairOf(candidate, evidence),
    mode: 'suggested',
    suggestionReason: reason,
    conflicts,
    copied: {},
  };
}
