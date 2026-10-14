/**
 * Roles of plan 2.2 (spec §13.2; engineering default, DECISIONS.md §D 2026-10-09). Drafts of profiles
 * and rates are master data: a master-data admin or a manager approver. Approving, retiring and
 * importing (an import writes approved rows) needs a manager approver. Valuation rates are finance's
 * (SME V1: `v2/valuation/valuation-roles.ts`). Reads: any tenant member.
 */
export const PROFILE_WRITERS = [
  'master_data_admin',
  'manager_approver',
] as const;

export const PROFILE_APPROVERS = ['manager_approver'] as const;
