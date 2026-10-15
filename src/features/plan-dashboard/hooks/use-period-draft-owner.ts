import { useAuth } from '@/contexts/AuthContext';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { sessionAuthorityKey } from '@/features/auth/session-authority-key';

export function usePeriodDraftOwner(): string | null {
  const { session } = useAuth();
  const tenantId = useV2TenantId();
  return session && tenantId ? `${sessionAuthorityKey(session.user)}:${tenantId}` : null;
}
