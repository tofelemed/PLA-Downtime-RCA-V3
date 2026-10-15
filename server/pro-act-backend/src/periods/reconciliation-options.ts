import { PolicyBodyError } from './policy-bodies';

/**
 * SME D12 submission gate of a shift period: every stop has a specific reason or "investigation pending"
 * and the coded share of stopped time reaches `codedRatioTarget` (pilot 95 % by shift end). `warn` shows
 * the result on the period page; `block` refuses the submission (422 CODING_INCOMPLETE).
 */
export interface SubmitGateOption {
  mode: 'block' | 'warn';
  codedRatioTarget: number;
}

/**
 * SME R8 per-unit bridge limits (null = no limit): a bridge line above `absolute` (slice unit of measure) or
 * above `relative` × the slice plan target needs a second independent reviewer before approval
 * (`second_review`) or is refused at save (`refuse`).
 */
export interface BridgeLimitsOption {
  absolute: number | null;
  relative: number | null;
  overLimit: 'second_review' | 'refuse';
  /**
   * SME E4: the approved uncertainty budget of the unit whose expanded uncertainty justifies the absolute
   * limit (shown with the findings, like the tolerance's justification); absent = none stated
   */
  uncertaintyBudgetId?: string;
}

/** Options of a `reconciliation_tolerance` body a version may state (older versions have none). */
export interface ReconciliationOptions {
  submitGate?: SubmitGateOption;
  bridgeLimits?: BridgeLimitsOption;
  /** SME R9: loss kinds an evidence-backed `reversal` line may reverse */
  reversibleKinds?: string[];
}

/** Kinds a person or the engine claims as a loss and may later be found erroneous (SME R9 pilot list). */
export const DEFAULT_REVERSIBLE_KINDS = [
  'availability',
  'performance',
  'quality',
  'transition_allowance',
  'transition_excess',
  'gain',
  'bridge',
  'unaccounted_classified',
] as const;

/** What a version without the options behaves like: gate `warn` at 95 %, no bridge limit (pilot defaults). */
export const SUBMIT_GATE_DEFAULT: SubmitGateOption = {
  mode: 'warn',
  codedRatioTarget: 0.95,
};
export const BRIDGE_LIMITS_DEFAULT: BridgeLimitsOption = {
  absolute: null,
  relative: null,
  overLimit: 'second_review',
};

export const RECONCILIATION_OPTIONS_DEFAULT: Required<ReconciliationOptions> = {
  submitGate: SUBMIT_GATE_DEFAULT,
  bridgeLimits: BRIDGE_LIMITS_DEFAULT,
  reversibleKinds: [...DEFAULT_REVERSIBLE_KINDS],
};

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PolicyBodyError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function limit(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !(value >= 0)) {
    throw new PolicyBodyError(`${field} must be a number ≥ 0 or null`);
  }
  return value;
}

function choice<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (!(allowed as readonly unknown[]).includes(value)) {
    throw new PolicyBodyError(`${field} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function submitGate(value: unknown): SubmitGateOption {
  const raw = record(value, 'submitGate');
  const target = raw.codedRatioTarget;
  if (typeof target !== 'number' || !(target >= 0 && target <= 1)) {
    throw new PolicyBodyError(
      'submitGate.codedRatioTarget must be a ratio between 0 and 1',
    );
  }
  return {
    mode: choice(raw.mode, ['block', 'warn'], 'submitGate.mode'),
    codedRatioTarget: target,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function budgetRef(raw: Record<string, unknown>): {
  uncertaintyBudgetId?: string;
} {
  const id = raw.uncertaintyBudgetId;
  if (id === undefined || id === null) return {};
  if (typeof id !== 'string' || !UUID.test(id)) {
    throw new PolicyBodyError(
      'bridgeLimits.uncertaintyBudgetId must be a uuid',
    );
  }
  if (raw.absolute === null || raw.absolute === undefined) {
    throw new PolicyBodyError(
      'an uncertainty budget justifies an absolute bridge limit only',
    );
  }
  return { uncertaintyBudgetId: id };
}

function bridgeLimits(value: unknown): BridgeLimitsOption {
  const raw = record(value, 'bridgeLimits');
  return {
    absolute: limit(raw.absolute, 'bridgeLimits.absolute'),
    relative: limit(raw.relative, 'bridgeLimits.relative'),
    overLimit: choice(
      raw.overLimit,
      ['second_review', 'refuse'],
      'bridgeLimits.overLimit',
    ),
    ...budgetRef(raw),
  };
}

function reversibleKinds(value: unknown): string[] {
  const allowed: readonly string[] = DEFAULT_REVERSIBLE_KINDS;
  if (
    !Array.isArray(value) ||
    value.some((k) => typeof k !== 'string' || !allowed.includes(k))
  ) {
    throw new PolicyBodyError(
      `reversibleKinds must be a list of ${allowed.join(', ')}`,
    );
  }
  return [...new Set(value as string[])];
}

/**
 * The options a body states, parsed; absent options stay absent so the content hash of a revision reviewed
 * under an older version never changes (readers apply the defaults through the `…Of` helpers).
 */
export function reconciliationOptions(
  value: Record<string, unknown>,
): ReconciliationOptions {
  const options: ReconciliationOptions = {};
  if (value.submitGate !== undefined)
    options.submitGate = submitGate(value.submitGate);
  if (value.bridgeLimits !== undefined)
    options.bridgeLimits = bridgeLimits(value.bridgeLimits);
  if (value.reversibleKinds !== undefined)
    options.reversibleKinds = reversibleKinds(value.reversibleKinds);
  return options;
}

export const submitGateOf = (o: ReconciliationOptions): SubmitGateOption =>
  o.submitGate ?? SUBMIT_GATE_DEFAULT;
export const bridgeLimitsOf = (o: ReconciliationOptions): BridgeLimitsOption =>
  o.bridgeLimits ?? BRIDGE_LIMITS_DEFAULT;
export const reversibleKindsOf = (o: ReconciliationOptions): string[] =>
  o.reversibleKinds ?? [...DEFAULT_REVERSIBLE_KINDS];
