import { PolicyBodyError } from './policy-body-error';

export type LossGrain = 'shift' | 'day';
export type LossBasis = 'computed' | 'declared';
export type LossTargetSource = 'plan' | 'declared';

/** `loss_accounting` body: the basis, grain and tolerance of the plant's production loss accounting. */
export interface LossAccountingPolicy {
  grain: LossGrain;
  /** 'HH:mm' plant-local; used when grain = 'day' */
  dayStart: string;
  lossBasis: LossBasis;
  targetSource: LossTargetSource;
  accountingUnitId: string | null;
  stopsCrossCheck: boolean;
  /** ≥ 0, in the event's uom */
  identityTolerance: number;
}

export const LOSS_ACCOUNTING_DEFAULT: LossAccountingPolicy = {
  grain: 'shift',
  dayStart: '06:00',
  lossBasis: 'computed',
  targetSource: 'plan',
  accountingUnitId: null,
  stopsCrossCheck: true,
  identityTolerance: 0,
};

const FIELDS = Object.keys(LOSS_ACCOUNTING_DEFAULT);
const DAY_START = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function accountingUnit(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new PolicyBodyError('accountingUnitId must be a uuid or null');
  }
  return value;
}

function dayStart(value: unknown): string {
  if (typeof value !== 'string' || !DAY_START.test(value)) {
    throw new PolicyBodyError('dayStart must be HH:mm');
  }
  return value;
}

function tolerance(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new PolicyBodyError('identityTolerance must be a number ≥ 0');
  }
  return value;
}

/**
 * Parses a `loss_accounting` body. Unknown fields are refused; a missing field takes the default.
 * `targetSource` only matters in declared mode, so it is normalised to `plan` when the basis is computed.
 */
export function parseLossAccounting(body: unknown): LossAccountingPolicy {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new PolicyBodyError('policy body must be an object');
  }
  const extra = Object.keys(body).filter((key) => !FIELDS.includes(key));
  if (extra.length > 0) {
    throw new PolicyBodyError(`unknown field(s): ${extra.join(', ')}`);
  }
  const value: Record<string, unknown> = {
    ...LOSS_ACCOUNTING_DEFAULT,
    ...body,
  };
  const lossBasis = oneOf(
    value.lossBasis,
    ['computed', 'declared'],
    'lossBasis',
  );
  const targetSource = oneOf(
    value.targetSource,
    ['plan', 'declared'],
    'targetSource',
  );
  if (typeof value.stopsCrossCheck !== 'boolean') {
    throw new PolicyBodyError('stopsCrossCheck must be a boolean');
  }
  return {
    grain: oneOf(value.grain, ['shift', 'day'], 'grain'),
    dayStart: dayStart(value.dayStart),
    lossBasis,
    targetSource: lossBasis === 'computed' ? 'plan' : targetSource,
    accountingUnitId: accountingUnit(value.accountingUnitId),
    stopsCrossCheck: value.stopsCrossCheck,
    identityTolerance: tolerance(value.identityTolerance),
  };
}
