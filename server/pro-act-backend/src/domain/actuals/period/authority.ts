import { unionSeconds } from '../../time/interval-algebra';
import { Dec, formatDec } from '../decimal';
import {
  atSliceBoundary,
  boundaryMismatch,
  crossBoundaryFinding,
  estimateEntryOf,
  hierarchyOf,
  measuredEntries,
  refOf,
} from './measurement-hierarchy';
import {
  ActualsSource,
  FallbackCondition,
  HierarchyEntry,
  MeasurementHierarchy,
  PeriodFinding,
  RankedSourceRef,
  SourceAuthorityPolicy,
  SourceCandidate,
  SourceSubstitution,
  Window,
} from './period-actuals.types';

/**
 * What each policy source said about the window; `ambiguous` sources had several unflagged signals.
 * `byRank` holds the candidates of hierarchy entries that name one signal or a time lag (SME E7).
 */
export interface CandidateSet {
  candidates: Partial<Record<ActualsSource, SourceCandidate>>;
  byRank?: Record<number, SourceCandidate>;
  ambiguous: ActualsSource[];
}

export interface AuthoritySelection {
  selected: SourceCandidate | null;
  role: 'primary' | 'fallback' | null;
  findings: PeriodFinding[];
  /** SME E7: a lower rank than the top one was used; null / absent = the top rank (or nothing) */
  substitution?: SourceSubstitution | null;
  /** the top-ranked source (what an approved estimate replaces) */
  top?: RankedSourceRef | null;
  /** the hierarchy's approved-estimate rank; null = estimates are not part of it */
  estimateEntry?: HierarchyEntry | null;
  /** the version states a measurement hierarchy (E7) rather than primary / fallback */
  hierarchyConfigured?: boolean;
}

interface Ranked {
  entry: HierarchyEntry;
  candidate: SourceCandidate | null;
}

/**
 * One authority per slice (SRC01, D05, T12, SME E7). Sources are ranked at the slice's measurement
 * boundary; the best rank is used whenever it has data and a lower rank replaces it only under a
 * configured condition — `primary_missing` / `primary_stale` (no data in the window) or
 * `primary_bad_quality` (the better source is incomplete and the lower one complete). `primary_conflict`
 * never switches automatically. A source at another boundary stands in only when its stock change is
 * accounted for (`cross_boundary_substitution`); otherwise, whenever it would have been needed, a
 * `boundary_mismatch` problem says so and it is not used. When the selected source and the next one
 * both quantify the window and differ by more than `conflictTolerance`, a `source_conflict` problem
 * names both values; only the selected quantity is ever used, so output is never doubled or averaged.
 */
export function selectAuthority(
  policy: SourceAuthorityPolicy,
  set: CandidateSet,
  window: Window,
): AuthoritySelection {
  const hierarchy = hierarchyOf(policy);
  const configured = policy.measurementHierarchy !== undefined;
  const findings = ambiguousFindings(set, hierarchy, configured);
  const ranked = measuredEntries(hierarchy).map((entry) => ({
    entry,
    candidate: candidateOf(set, entry),
  }));
  const walk = walkRanks(hierarchy, ranked, window);
  findings.push(...walk.findings);
  const top = ranked.find((r) => atSliceBoundary(hierarchy, r.entry)) ?? null;
  const current = walk.current;
  const selected = current?.candidate ?? null;
  const conflict = selected
    ? conflictWithNext(policy, hierarchy, ranked, current)
    : null;
  if (conflict) findings.push(conflict);
  const substituted = current !== null && top !== null && current !== top;
  if (substituted && selected) {
    const bridged = crossBoundaryFinding(
      hierarchy,
      current.entry,
      selected.label,
    );
    if (bridged) findings.push(bridged);
  }
  return {
    selected,
    role: selected ? (substituted ? 'fallback' : 'primary') : null,
    findings,
    substitution:
      substituted && selected && top
        ? substitutionOf(current, top, walk.firstReason, selected.label)
        : null,
    top: top ? refOf(top.entry) : null,
    estimateEntry: estimateEntryOf(hierarchy),
    hierarchyConfigured: configured,
  };
}

/**
 * Down the ranks: the first rank at the boundary is current; each lower rank with data replaces it when a
 * step-down condition holds, else the walk stops. Off-boundary sources with data are reported when the
 * current source is not complete (they would have been needed).
 */
function walkRanks(
  hierarchy: MeasurementHierarchy,
  ranked: readonly Ranked[],
  window: Window,
): {
  current: Ranked | null;
  findings: PeriodFinding[];
  firstReason: FallbackCondition | null;
} {
  const findings: PeriodFinding[] = [];
  let current: Ranked | null = null;
  let firstReason: FallbackCondition | null = null;
  for (const next of ranked) {
    if (!atSliceBoundary(hierarchy, next.entry)) {
      if (next.candidate?.available && !settled(current, window)) {
        findings.push(
          boundaryMismatch(hierarchy, next.entry, next.candidate.label),
        );
      }
      continue;
    }
    if (!current) {
      current = next;
      continue;
    }
    if (!next.candidate?.available) continue;
    const reason = stepReason(
      hierarchy.conditions,
      current.candidate,
      next.candidate,
      window,
    );
    if (!reason) break;
    findings.push(fallbackFinding(current, next, reason));
    firstReason ??= reason;
    current = next;
  }
  return { current, findings, firstReason };
}

/** The current source is complete: lower ranks are not needed. */
function settled(current: Ranked | null, window: Window): boolean {
  return current?.candidate ? isComplete(current.candidate, window) : false;
}

function candidateOf(
  set: CandidateSet,
  entry: HierarchyEntry,
): SourceCandidate | null {
  return set.byRank?.[entry.rank] ?? set.candidates[entry.source] ?? null;
}

/** Ambiguity matters only for sources a rank takes by source type (not by named signal). */
function ambiguousFindings(
  set: CandidateSet,
  hierarchy: MeasurementHierarchy,
  configured: boolean,
): PeriodFinding[] {
  return set.ambiguous
    .filter(
      (source) =>
        !configured ||
        hierarchy.entries.some(
          (entry) => entry.source === source && !entry.signalSourceKey,
        ),
    )
    .map(ambiguousFinding);
}

function stepReason(
  conditions: readonly FallbackCondition[],
  current: SourceCandidate | null,
  next: SourceCandidate,
  window: Window,
): FallbackCondition | null {
  const missing = !current?.available;
  if (missing && conditions.includes('primary_missing'))
    return 'primary_missing';
  if (missing && conditions.includes('primary_stale')) return 'primary_stale';
  if (
    current &&
    !missing &&
    conditions.includes('primary_bad_quality') &&
    !isComplete(current, window) &&
    isComplete(next, window)
  ) {
    return 'primary_bad_quality';
  }
  return null;
}

function fallbackFinding(
  from: Ranked,
  to: Ranked,
  reason: FallbackCondition,
): PeriodFinding {
  const detail: Record<string, unknown> = {
    primary: from.entry.source,
    fallback: to.entry.source,
    reason,
  };
  if (from.entry.sourceClass || to.entry.sourceClass) {
    Object.assign(detail, {
      fromRank: from.entry.rank,
      toRank: to.entry.rank,
      fromClass: from.entry.sourceClass,
      toClass: to.entry.sourceClass,
    });
  }
  return { code: 'fallback_used', severity: 'info', detail };
}

function substitutionOf(
  used: Ranked,
  top: Ranked,
  reason: FallbackCondition | null,
  label: string,
): SourceSubstitution {
  const adjustment = used.entry.boundaryAdjustment;
  const bridged = adjustment && used.entry.boundary !== top.entry.boundary;
  return {
    used: { ...refOf(used.entry), label },
    replaced: refOf(top.entry),
    reason: reason ?? 'primary_missing',
    crossBoundary: bridged
      ? {
          fromBoundary: used.entry.boundary,
          lagSeconds: adjustment.lagSeconds,
          evidenceRef: adjustment.evidenceRef,
        }
      : null,
  };
}

/** Quantified, no problem finding and the whole window observed. */
export function isComplete(
  candidate: SourceCandidate,
  window: Window,
): boolean {
  const windowSeconds = (window.to.getTime() - window.from.getTime()) / 1000;
  return (
    candidate.quantity !== null &&
    !candidate.findings.some((finding) => finding.severity === 'problem') &&
    unionSeconds(candidate.observed) >= windowSeconds
  );
}

/** The selected source against the next rank at the boundary that has a candidate (T12). */
function conflictWithNext(
  policy: SourceAuthorityPolicy,
  hierarchy: MeasurementHierarchy,
  ranked: readonly Ranked[],
  current: Ranked | null,
): PeriodFinding | null {
  if (!current?.candidate) return null;
  const after = ranked.slice(ranked.indexOf(current) + 1);
  const next = after.find(
    (r) => atSliceBoundary(hierarchy, r.entry) && r.candidate !== null,
  );
  return next?.candidate
    ? conflictOf(policy, current.candidate, next.candidate)
    : null;
}

function conflictOf(
  policy: SourceAuthorityPolicy,
  primary: SourceCandidate,
  fallback: SourceCandidate,
): PeriodFinding | null {
  if (primary.quantity === null || fallback.quantity === null) return null;
  if (primary.basis !== fallback.basis) return null;
  const difference = primary.quantity.minus(fallback.quantity).abs();
  const relative = primary.quantity.isZero()
    ? difference.isZero()
      ? new Dec(0)
      : new Dec(Number.POSITIVE_INFINITY)
    : difference.div(primary.quantity.abs());
  if (relative.lte(policy.conflictTolerance)) return null;
  return {
    code: 'source_conflict',
    severity: 'problem',
    detail: {
      selected: primary.label,
      selectedQuantity: formatDec(primary.quantity),
      other: fallback.label,
      otherQuantity: formatDec(fallback.quantity),
      tolerance: policy.conflictTolerance,
    },
  };
}

function ambiguousFinding(source: ActualsSource): PeriodFinding {
  return {
    code: 'ambiguous_signal',
    severity: 'problem',
    detail: {
      source,
      reason: 'several signals of the unit match; flag one as authority',
    },
  };
}
