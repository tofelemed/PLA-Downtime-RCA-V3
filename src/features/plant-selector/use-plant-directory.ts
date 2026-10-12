import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { selectableTenants } from '@/contexts/plant-selection-store';
import { masterDataApi, type Asset, type Organization, type Tenant, type Unit } from '@/services/api/masterDataApi';

/** Plant directory lists change rarely (master data): fresh for 10 minutes, shared by every screen. */
export const DIRECTORY_STALE_MS = 10 * 60_000;

export const plantDirectoryKeys = {
  organizations: (userId: string) => ['v1', 'directory', userId, 'organizations'] as const,
  tenants: (userId: string) => ['v1', 'directory', userId, 'tenants'] as const,
  units: (tenantId: string) => ['v1', 'directory', 'units', tenantId] as const,
  assets: (unitId: string) => ['v1', 'directory', 'assets', unitId] as const,
};

export interface PlantDirectory {
  organizations: Organization[];
  tenants: Tenant[];
  isLoading: boolean;
}

/**
 * Organisations and the plants the user may select — the only lists the header needs on every page
 * (docs/UI_UX_AUDIT.md §4: the selector used to download every unit and asset on every page load).
 * Units and assets load per node, when the user opens it (`usePlantUnits`, `useUnitAssets`).
 */
export function usePlantDirectory(): PlantDirectory {
  const { session } = useAuth();
  const user = session?.user ?? null;
  const userId = user?.id ?? '-';
  const organizations = useQuery({
    queryKey: plantDirectoryKeys.organizations(userId),
    enabled: Boolean(user),
    staleTime: DIRECTORY_STALE_MS,
    queryFn: () => masterDataApi.getOrganizations(),
  });
  const tenants = useQuery({
    queryKey: plantDirectoryKeys.tenants(userId),
    enabled: Boolean(user),
    staleTime: DIRECTORY_STALE_MS,
    queryFn: () => masterDataApi.getTenants(),
    select: (rows) => (user ? selectableTenants(user, rows) : []),
  });
  const allowed = tenants.data ?? [];
  return {
    organizations: (organizations.data ?? []).filter((org) => allowed.some((tenant) => tenant.organizationId === org.id)),
    tenants: allowed,
    isLoading: organizations.isLoading || tenants.isLoading,
  };
}

/** Units of one plant, fetched when its node is expanded. */
export function usePlantUnits(tenantId: string, enabled: boolean) {
  return useQuery<Unit[]>({
    queryKey: plantDirectoryKeys.units(tenantId),
    enabled,
    staleTime: DIRECTORY_STALE_MS,
    queryFn: async () => (await masterDataApi.getUnits({ tenantId })).filter((unit) => unit.tenantId === tenantId),
  });
}

/** Assets of one unit, fetched when its node is expanded. */
export function useUnitAssets(unit: Unit, enabled: boolean) {
  return useQuery<Asset[]>({
    queryKey: plantDirectoryKeys.assets(unit.id),
    enabled,
    staleTime: DIRECTORY_STALE_MS,
    queryFn: async () =>
      (await masterDataApi.getAssets({ tenantId: unit.tenantId, unitId: unit.id })).filter((asset) => asset.unitId === unit.id),
  });
}
