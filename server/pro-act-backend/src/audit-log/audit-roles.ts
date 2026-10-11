/**
 * Who may read the audit trail (`GET /audit-logs`, `GET /audit-logs/:id`): the tenant's administrators
 * and approvers, in the tenant they act on. Mirrored by `AUDIT_READERS` in the frontend
 * `src/features/auth/server-role-sets.ts` (the Audit Logs menu item). Writing an entry stays open to
 * every member (client audit), editing one is SuperAdmin-only.
 */
export const AUDIT_READERS = [
  'SuperAdmin',
  'OrgAdmin',
  'TenantAdmin',
  'manager_approver',
] as const;
