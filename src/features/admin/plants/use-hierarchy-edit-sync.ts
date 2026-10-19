import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { OrganizationView, PlantDetailView } from '@/api/v2/types/administration';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';

export type SavedHierarchyRecord = { kind: 'organization'; view: OrganizationView } | { kind: 'plant'; view: PlantDetailView };

/**
 * After an organization / plant edit: the header's plant selection (kept in this browser with names)
 * shows the new name at once, and the plant directory and sites (display time zone) reload. The Admin
 * panel's own lists are refreshed by the command (`admin_config`).
 */
export function useHierarchyEditSync() {
  const queryClient = useQueryClient();
  const tenantId = useV2TenantId();
  const { selection, setSelection } = usePlantSelection();
  return useCallback(
    async (saved: SavedHierarchyRecord) => {
      if (saved.kind === 'organization' && selection?.organization?.id === saved.view.id) {
        setSelection({ ...selection, organization: { ...selection.organization, name: saved.view.name } });
      }
      if (saved.kind === 'plant' && selection?.tenant?.id === saved.view.id) {
        setSelection({ ...selection, tenant: { ...selection.tenant, name: saved.view.name, timezone: saved.view.timezone } });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['v2', 'directory'] }),
        tenantId ? queryClient.invalidateQueries({ queryKey: v2Keys.resource(tenantId, 'sites') }) : Promise.resolve(),
      ]);
    },
    [queryClient, selection, setSelection, tenantId],
  );
}
