import { unionSeconds } from '../../time/interval-algebra';
import { Dec, formatDec } from '../decimal';
import {
  ActualsSource,
  FallbackCondition,
  PeriodFinding,
  SourceAuthorityPolicy,
  SourceCandidate,
  Window,
} from './period-actuals.types';

/** What each policy source said about the window; `ambiguous` sources had several unflagged signals. */
export interface CandidateSet {
  candidates: Partial<Record<ActualsSource, SourceCandidate>>;
  ambiguous: ActualsSource[];
}

export interface AuthoritySelection {
  selected: SourceCandidate | null;
  role: 'primary' | 'fallback' | null;
  findings: PeriodFinding[];
}

/**
 * One authority per slice (SRC01, D05, T12): the policy's primary source is used whenever it has data;
 * its fallback replaces it only under a configured condition — `primary_missing` / `primary_stale`
 * (no primary data in the window) or `primary_bad_quality` (the primary is incomplete and the fallback is
 * complete). `primary_conflict` never switches automatically. When both sources quantify the window and
 * differ by more than `conflictTolerance` (relative to the primary), a `source_conflict` problem names
 * both values; only the selected quantity is ever used, so output is never doubled or averaged.
 */
export function selectAuthority(
  policy: SourceAuthorityPolicy,
  set: CandidateSet,
  window: Window,
): AuthoritySelection {
  const findings = set.ambiguous.map(ambiguousFinding);
  const primary = set.candidates[policy.primarySource] ?? null;
  const fallbackSource = policy.fallback?.source ?? null;
  const fallback = fallbackSource
    ? (set.candidates[fallbackSource] ?? null)
    : null;
  const reason = fallbackReason(policy, { primary, fallback }, window);
  if (reason && fallback) {
    findings.push({
      code: 'fallback_used',
      severity: 'info',
      detail: {
        primary: policy.primarySource,
        fallback: fallbackSource,
        reason,
      },
    });
    return { selected: fallback, role: 'fallback', findings };
  }
  const conflict =
    primary && fallback ? conflictOf(policy, primary, fallback) : null;
  if (conflict) findings.push(conflict);
  return { selected: primary, role: primary ? 'primary' : null, findings };
}

function fallbackReason(
  policy: SourceAuthorityPolicy,
  pair: { primary: SourceCandidate | null; fallback: SourceCandidate | null },
  window: Window,
): FallbackCondition | null {
  const { primary, fallback } = pair;
  const conditions = policy.fallback?.conditions ?? [];
  if (!fallback?.available) return null;
  const missing = !primary?.available;
  if (missing && conditions.includes('primary_missing'))
    return 'primary_missing';
  if (missing && conditions.includes('primary_stale')) return 'primary_stale';
  if (
    primary &&
    !missing &&
    conditions.includes('primary_bad_quality') &&
    !isComplete(primary, window) &&
    isComplete(fallback, window)
  ) {
    return 'primary_bad_quality';
  }
  return null;
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
