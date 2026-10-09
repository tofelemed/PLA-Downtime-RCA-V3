import { useAuth } from '@/contexts/AuthContext';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { useScopedRealtime } from '@/realtime/use-scoped-realtime';

/** Mounts the scoped realtime connection while signed in (one per page, shared by every screen). */
export function RealtimeBridge(): null {
  const { session, getAccessToken } = useAuth();
  const tenantId = useV2TenantId();
  useScopedRealtime({ tenantId: session ? tenantId : null, getAccessToken });
  return null;
}
