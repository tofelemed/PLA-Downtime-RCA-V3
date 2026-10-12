import type { ValuationPolicyView } from '@/api/v2/types/valuation';

/**
 * How a valuation policy version is shown (plan 2.6): approved (in production use from its start),
 * unapproved (values nothing until finance approves it) or the placeholder of the earlier setup (the
 * server lists no reporting currency for it and refuses its approval with 422 CURRENCY_UNDECIDED).
 */
export type PolicyStatus = 'approved' | 'unapproved' | 'placeholder';

export function policyStatus(policy: ValuationPolicyView): PolicyStatus {
  if (policy.approved) return 'approved';
  return policy.reportingCurrencies.length === 0 ? 'placeholder' : 'unapproved';
}

/** Whether any version carries the finance approval; none → every loss stays "unvalued (policy pending)". */
export const anyApproved = (policies: readonly ValuationPolicyView[]): boolean => policies.some((policy) => policy.approved);

export type Authorship = 'you' | 'someone-else' | 'system';

/** Who wrote the version, relative to the viewer (the author cannot approve: 403 SEPARATION_OF_DUTIES). */
export function authorshipOf(policy: ValuationPolicyView, userId: string | null): Authorship {
  if (!policy.createdBy) return 'system';
  return userId !== null && policy.createdBy === userId ? 'you' : 'someone-else';
}

/** "IRR + USD", or "None" for the placeholder. */
export const currenciesLabel = (policy: ValuationPolicyView): string =>
  policy.reportingCurrencies.length > 0 ? policy.reportingCurrencies.join(' + ') : 'None';
