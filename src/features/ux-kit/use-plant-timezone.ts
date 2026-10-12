import { useAuth } from '@/contexts/AuthContext';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { choosePlantTimezone, PlantTimezone, useSites } from '@/api/v2/queries/reference-data';

/**
 * The plant display timezone (D03): default site, else the acting plant's tenant setting (the
 * selected plant, then the session's — CLAUDE.md), else a labelled UTC fallback.
 */
export function usePlantTimezone(): PlantTimezone & { loading: boolean } {
  const { session } = useAuth();
  const { selection } = usePlantSelection();
  const sites = useSites();
  const acting = selection?.tenant?.id ? selection.tenant : session?.tenant;
  const tenantTimezone = (acting as { timezone?: string | null } | null | undefined)?.timezone;
  return { ...choosePlantTimezone(sites.data?.items, tenantTimezone), loading: sites.isLoading };
}
