import { PolicyBodyError } from './policy-bodies';

/** `oee_policy` body (contracts/policies/oee_policy.schema.json, D04). */
export interface OeePolicy {
  plannedStopsInsideScheduleReduceAvailability: boolean;
  derateComponent: 'performance' | 'availability';
  microStopSeconds: number;
  idealTimeWeighting: boolean;
  maxUnknownShare: number;
  reconciledOeeTileEnabled: boolean;
  streamCombinationRule: string;
  defaultLedgerView: 'plan' | 'capacity';
  /**
   * SME Q11 / D7: how overlapping stops share time. New versions default to `first_out` (14 Oct 2026); a
   * version written before the option has no field and keeps its equal shares.
   */
  overlapAllocation: 'equal_share' | 'first_out';
}

/** `reconciliation_tolerance` body (contracts/policies/reconciliation_tolerance.schema.json, D06). */
export interface ReconciliationTolerance {
  mode: 'zero' | 'percent' | 'absolute';
  value: number;
  epsilon: number;
  allowUnaccountedClassification: boolean;
}

/**
 * D04 / D06 defaults recorded 2026-10-07 — the bodies of `contracts/policies/defaults/oee_policy.default.json`
 * and `reconciliation_tolerance.default.json` (kept equal by `policy-bodies.spec.ts`). Used to seed a
 * tenant's first version, never as a silent fallback for a stored policy.
 */
export const OEE_POLICY_DEFAULT: OeePolicy = {
  plannedStopsInsideScheduleReduceAvailability: true,
  derateComponent: 'performance',
  microStopSeconds: 60,
  idealTimeWeighting: true,
  maxUnknownShare: 0,
  reconciledOeeTileEnabled: true,
  streamCombinationRule: 'per_product_and_combined_when_compatible',
  defaultLedgerView: 'plan',
  overlapAllocation: 'first_out',
};

export const RECONCILIATION_TOLERANCE_DEFAULT: ReconciliationTolerance = {
  mode: 'zero',
  value: 0,
  epsilon: 0.000001,
  allowUnaccountedClassification: false,
};

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PolicyBodyError('policy body must be an object');
  }
  return value as Record<string, unknown>;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (!(allowed as readonly unknown[]).includes(value)) {
    throw new PolicyBodyError(`${field} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function nonNegative(value: unknown, field: string): number {
  if (typeof value !== 'number' || !(value >= 0)) {
    throw new PolicyBodyError(`${field} must be a number ≥ 0`);
  }
  return value;
}

function flag(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean')
    throw new PolicyBodyError(`${field} must be a boolean`);
  return value;
}

export function parseOeePolicy(body: unknown): OeePolicy {
  const value = record(body);
  return {
    plannedStopsInsideScheduleReduceAvailability: flag(
      value.plannedStopsInsideScheduleReduceAvailability,
      'plannedStopsInsideScheduleReduceAvailability',
    ),
    derateComponent: oneOf(
      value.derateComponent,
      ['performance', 'availability'],
      'derateComponent',
    ),
    microStopSeconds: nonNegative(value.microStopSeconds, 'microStopSeconds'),
    idealTimeWeighting: flag(value.idealTimeWeighting, 'idealTimeWeighting'),
    maxUnknownShare: nonNegative(value.maxUnknownShare, 'maxUnknownShare'),
    reconciledOeeTileEnabled: flag(
      value.reconciledOeeTileEnabled,
      'reconciledOeeTileEnabled',
    ),
    streamCombinationRule:
      typeof value.streamCombinationRule === 'string'
        ? value.streamCombinationRule
        : '',
    defaultLedgerView: oneOf(
      value.defaultLedgerView,
      ['plan', 'capacity'],
      'defaultLedgerView',
    ),
    overlapAllocation:
      value.overlapAllocation === undefined
        ? 'equal_share'
        : oneOf(
            value.overlapAllocation,
            ['equal_share', 'first_out'],
            'overlapAllocation',
          ),
  };
}

export function parseReconciliationTolerance(
  body: unknown,
): ReconciliationTolerance {
  const value = record(body);
  return {
    mode: oneOf(value.mode, ['zero', 'percent', 'absolute'], 'mode'),
    value: nonNegative(value.value, 'value'),
    epsilon: nonNegative(value.epsilon, 'epsilon'),
    allowUnaccountedClassification: flag(
      value.allowUnaccountedClassification,
      'allowUnaccountedClassification',
    ),
  };
}
