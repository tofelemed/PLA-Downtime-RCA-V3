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
  /**
   * LA-08 (ISO 22400 / GE PLA common practice): whether the plan target already allows for grade
   * transitions within their approved standard. New versions default to `planned` (14 Oct 2026): the
   * allowance is planned time, not a plan-ledger loss; a version written before the option has no field
   * and keeps `loss`.
   */
  transitionAllowanceInPlan: 'planned' | 'loss';
  /**
   * SME D6: micro-stop threshold per asset class (asset type → seconds), overriding `microStopSeconds` for
   * stops of those assets (pilot 120 s for operator-cleared bagger / conveyor stops). Absent = none.
   */
  microStopSecondsByAssetClass?: Record<string, number>;
  /** SME D6: reason codes of process trips — always availability events, never micro-stops. Absent = none. */
  tripReasonCodes?: string[];
}

/** `reconciliation_tolerance` body (contracts/policies/reconciliation_tolerance.schema.json, D06). */
export interface ReconciliationTolerance {
  mode: 'zero' | 'percent' | 'absolute';
  value: number;
  epsilon: number;
  allowUnaccountedClassification: boolean;
  /**
   * SME R7: improvement target for unexplained loss as a share of the shortfall (0.02 = 2 %). Reporting only,
   * never the approval tolerance; a version written before the option has no field and no target (null).
   */
  unaccountedTargetOfShortfall: number | null;
  /**
   * SME E4: the approved uncertainty budget whose expanded uncertainty justifies an `absolute` tolerance
   * (shown as the justification). Absent = no stated justification (every version before E4).
   */
  uncertaintyBudgetId?: string;
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
  transitionAllowanceInPlan: 'planned',
};

export const RECONCILIATION_TOLERANCE_DEFAULT: ReconciliationTolerance = {
  mode: 'zero',
  value: 0,
  epsilon: 0.000001,
  allowUnaccountedClassification: false,
  unaccountedTargetOfShortfall: 0.02,
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

function ratioOrNull(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !(value >= 0 && value <= 1)) {
    throw new PolicyBodyError(`${field} must be a ratio between 0 and 1`);
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
    transitionAllowanceInPlan:
      value.transitionAllowanceInPlan === undefined
        ? 'loss'
        : oneOf(
            value.transitionAllowanceInPlan,
            ['planned', 'loss'],
            'transitionAllowanceInPlan',
          ),
    ...microStopOptions(value),
  };
}

/** SME D6 options of a body; only the fields a version states (older versions have none). */
function microStopOptions(
  value: Record<string, unknown>,
): Pick<OeePolicy, 'microStopSecondsByAssetClass' | 'tripReasonCodes'> {
  const options: Pick<
    OeePolicy,
    'microStopSecondsByAssetClass' | 'tripReasonCodes'
  > = {};
  if (value.microStopSecondsByAssetClass !== undefined) {
    const byClass = record(value.microStopSecondsByAssetClass);
    options.microStopSecondsByAssetClass = Object.fromEntries(
      Object.entries(byClass).map(([assetClass, seconds]) => [
        assetClass,
        nonNegative(seconds, `microStopSecondsByAssetClass.${assetClass}`),
      ]),
    );
  }
  if (value.tripReasonCodes !== undefined) {
    const codes = value.tripReasonCodes;
    if (!Array.isArray(codes) || codes.some((c) => typeof c !== 'string')) {
      throw new PolicyBodyError('tripReasonCodes must be a list of codes');
    }
    options.tripReasonCodes = codes as string[];
  }
  return options;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseReconciliationTolerance(
  body: unknown,
): ReconciliationTolerance {
  const value = record(body);
  const mode = oneOf(value.mode, ['zero', 'percent', 'absolute'], 'mode');
  const budgetId = value.uncertaintyBudgetId;
  if (budgetId !== undefined && budgetId !== null) {
    if (typeof budgetId !== 'string' || !UUID.test(budgetId)) {
      throw new PolicyBodyError('uncertaintyBudgetId must be a uuid');
    }
    if (mode !== 'absolute') {
      throw new PolicyBodyError(
        'an uncertainty budget justifies an absolute tolerance only',
      );
    }
  }
  return {
    mode,
    value: nonNegative(value.value, 'value'),
    epsilon: nonNegative(value.epsilon, 'epsilon'),
    allowUnaccountedClassification: flag(
      value.allowUnaccountedClassification,
      'allowUnaccountedClassification',
    ),
    unaccountedTargetOfShortfall: ratioOrNull(
      value.unaccountedTargetOfShortfall,
      'unaccountedTargetOfShortfall',
    ),
    ...(typeof budgetId === 'string' ? { uncertaintyBudgetId: budgetId } : {}),
  };
}
