import {
  SOURCE_AUTHORITY_APPROVERS,
  SOURCE_AUTHORITY_WRITERS,
} from '../source-authority/source-authority-roles';

/**
 * Production loss accounting policy (declared mode, D1-D12): the basis, grain and target of the plant's
 * loss accounting change every figure, so it is maker-checker master data like the source authority.
 * The plant administrator (TenantAdmin) drafts as well; the manager approves as well; never the author.
 */
export const LOSS_ACCOUNTING_WRITERS = [
  ...SOURCE_AUTHORITY_WRITERS,
  'TenantAdmin',
] as const;

export const LOSS_ACCOUNTING_APPROVERS = [
  ...SOURCE_AUTHORITY_APPROVERS,
  'manager_approver',
] as const;
