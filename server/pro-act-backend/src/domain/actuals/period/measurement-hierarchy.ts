import {
  HierarchyEntry,
  MeasurementHierarchy,
  PeriodFinding,
  RankedSourceRef,
  SourceAuthorityPolicy,
} from './period-actuals.types';

/**
 * The ranked sources of a `source_authority` version (SME E7). A version without a hierarchy (written
 * before E7) is its primary then its fallback at one unnamed boundary, stepping down under the
 * fallback's conditions — exactly the D05 primary / fallback rule.
 */
export function hierarchyOf(
  policy: SourceAuthorityPolicy,
): MeasurementHierarchy {
  if (policy.measurementHierarchy) return policy.measurementHierarchy;
  const entry = (
    rank: number,
    source: HierarchyEntry['source'],
  ): HierarchyEntry => ({
    rank,
    sourceClass: null,
    source,
    signalSourceKey: null,
    boundary: null,
    boundaryAdjustment: null,
  });
  const entries = [entry(1, policy.primarySource)];
  if (policy.fallback) entries.push(entry(2, policy.fallback.source));
  return {
    boundary: null,
    conditions: policy.fallback?.conditions ?? [],
    entries,
  };
}

/** Measured at the slice's boundary, or bridged with the stock change accounted for. */
export function atSliceBoundary(
  hierarchy: MeasurementHierarchy,
  entry: HierarchyEntry,
): boolean {
  if (entry.boundary === hierarchy.boundary) return true;
  return entry.boundaryAdjustment?.inventoryChangeAccounted === true;
}

/** Entries that are sources of data, best rank first (the approved estimate is applied as adjustments). */
export function measuredEntries(
  hierarchy: MeasurementHierarchy,
): HierarchyEntry[] {
  return hierarchy.entries
    .filter((entry) => entry.sourceClass !== 'approved_estimate')
    .sort((a, b) => a.rank - b.rank);
}

export function estimateEntryOf(
  hierarchy: MeasurementHierarchy,
): HierarchyEntry | null {
  return (
    hierarchy.entries.find(
      (entry) => entry.sourceClass === 'approved_estimate',
    ) ?? null
  );
}

export function refOf(entry: HierarchyEntry): RankedSourceRef {
  return {
    rank: entry.rank,
    sourceClass: entry.sourceClass,
    source: entry.source,
    boundary: entry.boundary,
  };
}

/** A source with data at another boundary that may not stand in for the slice's (E7, never silent). */
export function boundaryMismatch(
  hierarchy: MeasurementHierarchy,
  entry: HierarchyEntry,
  label: string,
): PeriodFinding {
  return {
    code: 'boundary_mismatch',
    severity: 'problem',
    detail: {
      source: label,
      rank: entry.rank,
      sourceBoundary: entry.boundary,
      sliceBoundary: hierarchy.boundary,
      reason:
        'measured at another boundary without the stock change and time lag accounted for; not used',
    },
  };
}

/** The bridged source that was used, with its lag and evidence. */
export function crossBoundaryFinding(
  hierarchy: MeasurementHierarchy,
  entry: HierarchyEntry,
  label: string,
): PeriodFinding | null {
  const adjustment = entry.boundaryAdjustment;
  if (!adjustment || entry.boundary === hierarchy.boundary) return null;
  return {
    code: 'cross_boundary_substitution',
    severity: 'info',
    detail: {
      source: label,
      sourceBoundary: entry.boundary,
      sliceBoundary: hierarchy.boundary,
      lagSeconds: adjustment.lagSeconds,
      evidenceRef: adjustment.evidenceRef,
    },
  };
}
