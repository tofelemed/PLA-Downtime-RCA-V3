import { useAuth } from '@/contexts/AuthContext';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { choosePlantTimezone, PlantTimezone, useSites } from '@/api/v2/queries/reference-data';
import { useActingTenant } from '@/features/settings/use-tenant-display-settings';

/**
 * The plant display timezone (D03): default site, else the acting plant's tenant setting — the fresh
 * plant record (refetched after a settings save), then the selected plant's or session's snapshot
 * (CLAUDE.md) while it loads — else a labelled UTC fallback.
 */
export function usePlantTimezone(): PlantTimezone & { loading: boolean } {
  const { session } = useAuth();
  const { selection } = usePlantSelection();
  const sites = useSites();
  const plant = useActingTenant();
  const acting = selection?.tenant?.id ? selection.tenant : session?.tenant;
  const snapshot = (acting as { timezone?: string | null } | null | undefined)?.timezone;
  const tenantTimezone = plant.data?.timezone ?? snapshot;
  return { ...choosePlantTimezone(sites.data?.items, tenantTimezone), loading: sites.isLoading };
}
