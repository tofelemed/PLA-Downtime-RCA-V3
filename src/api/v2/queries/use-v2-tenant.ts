import { useAuth } from '@/contexts/AuthContext';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';

/**
 * Acting tenant of the v2 cache and client (CLAUDE.md): `plantSelection?.tenant?.id || session?.tenant?.id`.
 * Null while signed out or before a tenant is known; v2 queries stay disabled until then.
 */
export function resolveTenantId(
  selectionTenantId: string | undefined | null,
  sessionTenantId: string | undefined | null,
): string | null {
  return selectionTenantId || sessionTenantId || null;
}

export function useV2TenantId(): string | null {
  const { session } = useAuth();
  const { selection } = usePlantSelection();
  return resolveTenantId(selection?.tenant?.id, session?.tenant?.id);
}
