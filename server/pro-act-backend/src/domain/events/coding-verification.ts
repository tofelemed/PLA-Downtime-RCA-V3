/**
 * SME D13 staged verification of stop coding: the operator (or anyone recording) enters the coding, a
 * supervisor verifies it, maintenance validates the technical failure detail where there is one. Recording
 * is never blocked; verification only labels the stop.
 */

/** Fields whose change makes a supervisor's verification stale (what the supervisor confirmed). */
export const VERIFIED_FIELDS: readonly string[] = [
  'reasonCodeId',
  'investigationPending',
  'impactCodeId',
  'oeeCodeId',
  'scheduleClass',
  'oeeComponent',
  'impactMode',
  'impactFraction',
  'originUnitId',
  'originAssetId',
  'startTime',
  'endTime',
];

/** Failure detail maintenance validates (ISO 14224 fields of SME D11). */
export const VALIDATED_FIELDS: readonly string[] = [
  'failureMode',
  'failureSeverity',
  'maintainableItem',
  'failureMechanism',
  'failureCause',
  'detectionMethod',
];

export interface VerificationColumns {
  verifiedBy: string | null;
  verifiedAt: Date | null;
  validatedBy: string | null;
  validatedAt: Date | null;
}

/** The columns a user change clears: verification when the coding changed, validation when the detail did. */
export function verificationReset(
  changed: readonly string[],
): Partial<VerificationColumns> {
  const reset: Partial<VerificationColumns> = {};
  if (changed.some((field) => VERIFIED_FIELDS.includes(field))) {
    reset.verifiedBy = null;
    reset.verifiedAt = null;
  }
  if (changed.some((field) => VALIDATED_FIELDS.includes(field))) {
    reset.validatedBy = null;
    reset.validatedAt = null;
  }
  return reset;
}

/** What a stop looks like to the verification rules. */
export interface StopForVerification {
  isStop: boolean;
  reasonCodeId: string | null;
  investigationPending: boolean;
  verifiedAt: Date | null;
  validatedAt: Date | null;
  hasFailureDetail: boolean;
  /** author of the current coding revision (null = source or system) */
  codedBy: string | null;
}

export type VerifyRefusal =
  | 'NOT_A_STOP'
  | 'NOT_CODED'
  | 'ALREADY_VERIFIED'
  | 'OWN_CODING';

/**
 * Why a supervisor may not verify the stop (null = may): only stops with a reason or "investigation
 * pending", not yet verified, and never by the person who entered the current coding (maker–checker).
 */
export function verifyRefusal(
  stop: StopForVerification,
  verifier: string,
  isSuperAdmin = false,
): VerifyRefusal | null {
  if (!stop.isStop) return 'NOT_A_STOP';
  if (!stop.reasonCodeId && !stop.investigationPending) return 'NOT_CODED';
  if (stop.verifiedAt) return 'ALREADY_VERIFIED';
  if (!isSuperAdmin && stop.codedBy === verifier) return 'OWN_CODING';
  return null;
}

export type ValidateRefusal =
  | 'NOT_A_STOP'
  | 'NO_FAILURE_DETAIL'
  | 'NOT_VERIFIED'
  | 'ALREADY_VALIDATED'
  | 'OWN_CODING';

/**
 * Why maintenance may not validate the failure detail (null = may): a stop carrying failure detail, already
 * verified by the supervisor (stages in order), not yet validated, and not coded by the validator.
 */
export function validateRefusal(
  stop: StopForVerification,
  validator: string,
  isSuperAdmin = false,
): ValidateRefusal | null {
  if (!stop.isStop) return 'NOT_A_STOP';
  if (!stop.hasFailureDetail) return 'NO_FAILURE_DETAIL';
  if (!stop.verifiedAt) return 'NOT_VERIFIED';
  if (stop.validatedAt) return 'ALREADY_VALIDATED';
  if (!isSuperAdmin && stop.codedBy === validator) return 'OWN_CODING';
  return null;
}
