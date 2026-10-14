import { OPEN_ENDED } from './period-recalc';

/** Payload of `ProfileBaselineChanged` (profiles/profile-events.ts), as far as recalculation needs it. */
export interface BaselineChangedPayload {
  subject?: string;
  unitId?: string;
  profileIds?: string[];
  effectiveFrom?: string;
  effectiveTo?: string | null;
}

export interface BaselineLookups {
  /** profile id → unit id of the profiles named by the message */
  profileUnits: ReadonlyMap<string, string>;
  /** effective window of the rates an applied import wrote, null when it wrote none */
  importWindow: { from: Date; to: Date | null } | null;
}

/** Units (null = every unit of the tenant) and window whose periods a baseline change recalculates. */
export interface BaselineRecalcScope {
  unitIds: string[] | null;
  from: Date;
  /** `OPEN_ENDED` when the change has no end: future periods are recalculated too */
  to: Date;
}

function windowOf(
  payload: BaselineChangedPayload,
): { from: Date; to: Date } | null {
  if (!payload.effectiveFrom) return null;
  return {
    from: new Date(payload.effectiveFrom),
    to: payload.effectiveTo ? new Date(payload.effectiveTo) : OPEN_ENDED,
  };
}

function importScope(
  payload: BaselineChangedPayload,
  lookups: BaselineLookups,
): BaselineRecalcScope | null {
  const unitIds = (payload.profileIds ?? []).flatMap(
    (id) => lookups.profileUnits.get(id) ?? [],
  );
  const window = lookups.importWindow;
  if (!window || unitIds.length === 0) return null;
  return {
    unitIds: [...new Set(unitIds)],
    from: window.from,
    to: window.to ?? OPEN_ENDED,
  };
}

/** Subjects whose message names their unit (a transition standard is per unit, LA-08). */
const UNIT_SUBJECTS: ReadonlySet<string> = new Set([
  'profile',
  'transition_standard',
]);

/**
 * LA-03: which periods an approved-baseline change recalculates. A profile or a transition standard
 * names its unit; a rate or a
 * profile's valuation rate is located through its profile (the message's aggregate id); a valuation
 * rate of an impact code applies to every unit; an applied import covers its profiles' units over the
 * window of the rates it wrote. Null = nothing can be located (the recompute is skipped).
 */
export function baselineRecalcScope(
  aggregateId: string,
  payload: BaselineChangedPayload,
  lookups: BaselineLookups,
): BaselineRecalcScope | null {
  if (payload.subject === 'rate_import') return importScope(payload, lookups);
  const window = windowOf(payload);
  if (!window) return null;
  if (UNIT_SUBJECTS.has(payload.subject ?? '') && payload.unitId) {
    return { unitIds: [payload.unitId], ...window };
  }
  const unitId = lookups.profileUnits.get(aggregateId);
  if (unitId) return { unitIds: [unitId], ...window };
  return payload.subject === 'valuation_rate'
    ? { unitIds: null, ...window }
    : null;
}
