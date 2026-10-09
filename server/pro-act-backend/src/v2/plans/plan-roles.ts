/**
 * Roles of plan 2.3 (spec §13.2; engineering default, DECISIONS.md §D 2026-10-09). Plans are prepared by
 * production engineers (v1 Engineer/Analyst) or manager approvers; approving a version and writing
 * scenarios (tenant-wide) needs a manager approver. Reads and previews: any tenant member in scope.
 */
export const PLAN_WRITERS = [
  'production_engineer',
  'manager_approver',
] as const;

export const PLAN_APPROVERS = ['manager_approver'] as const;
