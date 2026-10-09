import { useAuth } from '@/contexts/AuthContext';
import { choosePlantTimezone, PlantTimezone, useSites } from '@/api/v2/queries/reference-data';

/** The plant display timezone (D03): default site, else the tenant setting, else a labelled UTC fallback. */
export function usePlantTimezone(): PlantTimezone & { loading: boolean } {
  const { session } = useAuth();
  const sites = useSites();
  const tenantTimezone = (session?.tenant as { timezone?: string | null } | null | undefined)?.timezone;
  return { ...choosePlantTimezone(sites.data?.items, tenantTimezone), loading: sites.isLoading };
}
