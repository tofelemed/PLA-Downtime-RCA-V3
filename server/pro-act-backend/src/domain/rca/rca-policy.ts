/**
 * `rca_policy` body (contracts/policies/rca_policy.schema.json, decision D13). Recommend-only by default;
 * the cost trigger stays off while `costThreshold` is null (D08: no amount was given).
 */
export interface RcaPolicy {
  /** confirmed (or elapsed, provisional) unplanned downtime at or above this fires; 0 disables */
  durationThresholdSeconds: number;
  /** approved valued impact threshold; null disables the cost trigger */
  costThreshold: number | null;
  /** functional failures of the same asset within `repeatWindowDays` that fire the repeat trigger */
  repeatCount: number;
  repeatWindowDays: number;
  autoCreate: 'recommend' | 'create';
}

/** D13 default recorded 2026-10-07 (`contracts/policies/defaults/rca_policy.default.json`). */
export const RCA_POLICY_DEFAULT: RcaPolicy = {
  durationThresholdSeconds: 3600,
  costThreshold: null,
  repeatCount: 3,
  repeatWindowDays: 30,
  autoCreate: 'recommend',
};

export class RcaPolicyError extends Error {}

function nonNegativeInteger(value: unknown, field: string, min = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new RcaPolicyError(`${field} must be an integer >= ${min}`);
  }
  return value;
}

/** Validates a stored body; a malformed policy is an error, never a silent default. */
export function parseRcaPolicy(body: unknown): RcaPolicy {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new RcaPolicyError('rca_policy body must be an object');
  }
  const raw = body as Record<string, unknown>;
  const cost = raw.costThreshold;
  if (cost !== null && (typeof cost !== 'number' || cost < 0)) {
    throw new RcaPolicyError('costThreshold must be null or a number >= 0');
  }
  if (raw.autoCreate !== 'recommend' && raw.autoCreate !== 'create') {
    throw new RcaPolicyError('autoCreate must be recommend or create');
  }
  return {
    durationThresholdSeconds: nonNegativeInteger(
      raw.durationThresholdSeconds,
      'durationThresholdSeconds',
    ),
    costThreshold: cost,
    repeatCount: nonNegativeInteger(raw.repeatCount, 'repeatCount', 1),
    repeatWindowDays: nonNegativeInteger(
      raw.repeatWindowDays,
      'repeatWindowDays',
      1,
    ),
    autoCreate: raw.autoCreate,
  };
}
