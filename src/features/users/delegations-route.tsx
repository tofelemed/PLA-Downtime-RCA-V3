import { useCapabilities } from '@/features/auth/use-capabilities';
import { DelegationsPage } from '@/features/delegations/delegations-page';
import { UserManagementRedirect } from './user-management-redirect';

/**
 * `/delegations` (QA re-test 2026-10-19): administrators keep delegations as a tab of User management (old
 * links redirect there); an approval-role holder who is not an administrator gets the page on its own as
 * "Approval delegations", their menu entry.
 */
export function DelegationsRoute() {
  const { canUseUserManagement } = useCapabilities();
  if (canUseUserManagement) return <UserManagementRedirect tab="delegations" />;
  return <DelegationsPage />;
}
