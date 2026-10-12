import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { UserView } from '@/api/v2/types/administration';

/** Whether the user's home plant is another plant than the selected one (a user granted in from there). */
export function useFromOtherPlant(user: Pick<UserView, 'tenantId'>): boolean {
  const tenantId = useV2TenantId();
  return Boolean(user.tenantId) && user.tenantId !== tenantId;
}
