/**
 * SME D13 staged verification of stop coding (15 Oct 2026, from the existing role sets): the supervisor of a
 * unit — plant management (`manager_approver`) or its production engineer — verifies the coding entered by
 * operators; maintenance (`reliability_engineer`) validates the technical failure detail. Each holds the
 * role for the stop's unit (tenant, site or unit grant, or a delegation).
 */
export const STOP_VERIFIERS = [
  'manager_approver',
  'production_engineer',
] as const;

export const FAILURE_VALIDATORS = ['reliability_engineer'] as const;
