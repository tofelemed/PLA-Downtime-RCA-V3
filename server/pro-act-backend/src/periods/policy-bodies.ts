import {
  ACTUALS_SOURCES,
  ActualsSource,
  CoverageGatePolicy,
  FallbackCondition,
  SourceAuthorityPolicy,
} from '../domain/actuals/period/period-actuals.types';

/**
 * D05 defaults recorded 2026-10-07 — the bodies of `contracts/policies/defaults/coverage_gate.default.json`
 * and `source_authority.default.json` (kept equal by `policy-bodies.spec.ts`). Used to seed a tenant's
 * first policy version, never as a silent fallback for a stored policy.
 */
export const COVERAGE_GATE_DEFAULT: CoverageGatePolicy = {
  requiredCoverageRatio: 1,
  allowProportionalEstimate: true,
  countApprovedSubstitutionsAsAccepted: true,
};

export const SOURCE_AUTHORITY_DEFAULT: SourceAuthorityPolicy = {
  measurement: 'output',
  productId: null,
  primarySource: 'pi_output_ef',
  fallback: {
    conditions: ['primary_stale', 'primary_bad_quality', 'primary_missing'],
    source: 'pi_counter',
  },
  cadenceSeconds: 60,
  conflictTolerance: 0,
  overrideRole: 'integration_admin',
};

const CONDITIONS: readonly FallbackCondition[] = [
  'primary_stale',
  'primary_bad_quality',
  'primary_missing',
  'primary_conflict',
];

/** A stored body that does not have the kind's shape (configuration error, never guessed around). */
export class PolicyBodyError extends Error {}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PolicyBodyError('policy body must be an object');
  }
  return value as Record<string, unknown>;
}

function ratio(value: unknown, field: string): number {
  if (typeof value !== 'number' || !(value >= 0 && value <= 1)) {
    throw new PolicyBodyError(`${field} must be a number in [0, 1]`);
  }
  return value;
}

function flag(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean')
    throw new PolicyBodyError(`${field} must be a boolean`);
  return value;
}

function source(value: unknown, field: string): ActualsSource {
  if (!(ACTUALS_SOURCES as readonly unknown[]).includes(value)) {
    throw new PolicyBodyError(
      `${field} must be one of ${ACTUALS_SOURCES.join(', ')}`,
    );
  }
  return value as ActualsSource;
}

export function parseCoverageGate(body: unknown): CoverageGatePolicy {
  const value = record(body);
  return {
    requiredCoverageRatio: ratio(
      value.requiredCoverageRatio,
      'requiredCoverageRatio',
    ),
    allowProportionalEstimate: flag(
      value.allowProportionalEstimate,
      'allowProportionalEstimate',
    ),
    countApprovedSubstitutionsAsAccepted: flag(
      value.countApprovedSubstitutionsAsAccepted,
      'countApprovedSubstitutionsAsAccepted',
    ),
  };
}

export function parseSourceAuthority(body: unknown): SourceAuthorityPolicy {
  const value = record(body);
  if (value.measurement !== 'output') {
    throw new PolicyBodyError(
      'actuals need a source_authority policy for measurement "output"',
    );
  }
  const fallback =
    value.fallback === null || value.fallback === undefined
      ? null
      : record(value.fallback);
  const conditions = fallback ? fallback.conditions : [];
  if (
    !Array.isArray(conditions) ||
    conditions.some((c) => !CONDITIONS.includes(c as FallbackCondition))
  ) {
    throw new PolicyBodyError(
      `fallback.conditions must be a subset of ${CONDITIONS.join(', ')}`,
    );
  }
  return {
    measurement: 'output',
    productId: typeof value.productId === 'string' ? value.productId : null,
    primarySource: source(value.primarySource, 'primarySource'),
    fallback: fallback
      ? {
          conditions: conditions as FallbackCondition[],
          source: source(fallback.source, 'fallback.source'),
        }
      : null,
    cadenceSeconds:
      typeof value.cadenceSeconds === 'number' ? value.cadenceSeconds : 60,
    conflictTolerance: ratio(value.conflictTolerance, 'conflictTolerance'),
    overrideRole:
      typeof value.overrideRole === 'string'
        ? value.overrideRole
        : 'integration_admin',
  };
}
