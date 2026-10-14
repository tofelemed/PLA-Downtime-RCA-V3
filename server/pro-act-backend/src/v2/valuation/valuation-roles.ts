/**
 * Finance roles of valuation (SME V1, 14 Oct 2026; VA-02): the money side of loss accounting is authored
 * by finance maintainers and approved by finance approvers — valuation policy versions, FX rates,
 * valuation rates (margins, costs, price differences) and demand statuses. The approver is never the
 * author (403 SEPARATION_OF_DUTIES in the services); operations and production managers read and use
 * approved values but cannot set them. SuperAdmin / OrgAdmin keep `satisfiesRole` behaviour.
 */
export const FINANCE_MAINTAINERS = ['finance_maintainer'] as const;

export const FINANCE_APPROVERS = ['finance_approver'] as const;
