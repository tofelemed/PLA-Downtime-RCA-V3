import type { ValuationPolicyView } from '@/api/v2/types/valuation';

/**
 * How a valuation policy version is shown (plan 2.6): approved (in production use from its start),
 * unapproved (values nothing until finance approves it) or the `XXX` placeholder (v1 history: the server
 * lists no reporting currency for it and refuses its approval with 422 CURRENCY_UNDECIDED).
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

const LABELS: Record<string, string> = {
  contribution_margin: 'Contribution margin',
  standard_cost: 'Standard cost',
  exclusive: 'Exclusive (one basis per loss)',
  independent_components: 'Independent components',
  none: 'No conversion',
  snapshot: 'Approved FX table',
};

/** A stored body value as text (the body is shown as stored; unknown values stay visible). */
export function bodyLabel(value: unknown): string {
  if (typeof value !== 'string') return '—';
  return LABELS[value] ?? value;
}
