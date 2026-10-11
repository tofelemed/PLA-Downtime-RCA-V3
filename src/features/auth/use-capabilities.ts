import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { capabilitiesOf, type Capabilities } from './capabilities';
import { effectiveRoles } from './effective-roles';

/**
 * Capabilities of the signed-in user in the selected plant (`plantSelection?.tenant?.id ||
 * session?.tenant?.id`, CLAUDE.md). Signed out: no capability at all.
 */
export function useCapabilities(): Capabilities {
  const { session } = useAuth();
  const { selection } = usePlantSelection();
  const user = session?.user ?? null;
  const tenantId = selection?.tenant?.id || session?.tenant?.id || null;
  const organizationId = selection?.tenant?.organizationId ?? session?.tenant?.organizationId ?? null;
  return useMemo(
    () => capabilitiesOf(user ? effectiveRoles(user, { tenantId, organizationId }) : []),
    [user, tenantId, organizationId],
  );
}
