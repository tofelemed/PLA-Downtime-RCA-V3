import { useCapabilities } from '@/features/auth/use-capabilities';

/**
 * True for a manager approver of the plant (or SuperAdmin): the role the server asks for baseline-correction
 * decisions and lesson sharing. The server enforces proposer independence for non-SuperAdmin users.
 */
export function useRcaApprover(): boolean {
  const { roles, isSuperAdmin } = useCapabilities();
  return isSuperAdmin || roles.includes('manager_approver');
}
