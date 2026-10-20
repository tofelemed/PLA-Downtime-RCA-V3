import { useQuery } from '@tanstack/react-query';
import { v2Request } from '@/api/v2/client';
import { fromSessionBootstrap } from '@/api/v2/queries/session-bootstrap';
import type { QueryParams } from '@/api/v2/request-url';
import type { ListResponse } from '@/api/v2/types/envelopes';
import type { DirectoryAsset, DirectoryOrganization, DirectoryPlant, DirectoryUnit } from '@/api/v2/types/plant-directory';
import { useAuth } from '@/contexts/AuthContext';
import { selectableTenants } from '@/contexts/plant-selection-store';

/** Plant directory lists change rarely (master data): fresh for 10 minutes, shared by every screen. */
export const DIRECTORY_STALE_MS = 10 * 60_000;

export const plantDirectoryKeys = {
  organizations: (userId: string) => ['v2', 'directory', userId, 'organizations'] as const,
  tenants: (userId: string) => ['v2', 'directory', userId, 'tenants'] as const,
  units: (tenantId: string) => ['v2', 'directory', 'units', tenantId] as const,
  assets: (unitId: string) => ['v2', 'directory', 'assets', unitId] as const,
};

interface PageOptions {
  /** read as this plant instead of the acting one */
  tenantId?: string;
  signal?: AbortSignal;
}

/** Every keyset page of a v2 list (directories are small: pages of 500). */
async function allPages<T>(path: string, query: QueryParams, options: PageOptions = {}): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = (await v2Request<ListResponse<T>>({ method: 'GET', path, query: { ...query, limit: 500, cursor }, ...options })).data;
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

export interface PlantDirectory {
  organizations: DirectoryOrganization[];
  tenants: DirectoryPlant[];
  isLoading: boolean;
  /** the failure of either list (null while both load or succeeded) */
  error: unknown;
  /** reloads the failed list(s) */
  retry: () => void;
}

/**
 * Organisations and the plants the user may select (`GET /v2/organizations`, `GET /v2/tenants`: the
 * server lists what the caller may see) — the only lists the header needs on every page. Units and assets
 * load per node, when the user opens it (`usePlantUnits`, `useUnitAssets`).
 */
export function usePlantDirectory(): PlantDirectory {
  const { session } = useAuth();
  const user = session?.user ?? null;
  const userId = user?.id ?? '-';
  const organizations = useQuery({
    queryKey: plantDirectoryKeys.organizations(userId),
    enabled: Boolean(user),
    staleTime: DIRECTORY_STALE_MS,
    queryFn: ({ signal }) => fromSessionBootstrap('organizations', () => allPages<DirectoryOrganization>('/organizations', {}, { signal })),
  });
  const tenants = useQuery({
    queryKey: plantDirectoryKeys.tenants(userId),
    enabled: Boolean(user),
    staleTime: DIRECTORY_STALE_MS,
    queryFn: ({ signal }) => fromSessionBootstrap('plants', () => allPages<DirectoryPlant>('/tenants', {}, { signal })),
    select: (rows) => (user ? selectableTenants(user, rows) : []),
  });
  const allowed = tenants.data ?? [];
  return {
    organizations: (organizations.data ?? []).filter((org) => allowed.some((tenant) => tenant.organizationId === org.id)),
    tenants: allowed,
    isLoading: organizations.isLoading || tenants.isLoading,
    error: organizations.error ?? tenants.error ?? null,
    retry: () => {
      if (organizations.isError) void organizations.refetch();
      if (tenants.isError) void tenants.refetch();
    },
  };
}

/** Units of one plant (`GET /v2/units` read as that plant), fetched when its node is expanded. */
export function usePlantUnits(tenantId: string, enabled: boolean) {
  return useQuery<DirectoryUnit[]>({
    queryKey: plantDirectoryKeys.units(tenantId),
    enabled,
    staleTime: DIRECTORY_STALE_MS,
    queryFn: ({ signal }) => allPages<DirectoryUnit>('/units', {}, { tenantId, signal }),
  });
}

/** Active assets of one unit (`GET /v2/assets` read as its plant), fetched when its node is expanded. */
export function useUnitAssets(tenantId: string, unit: DirectoryUnit, enabled: boolean) {
  return useQuery<DirectoryAsset[]>({
    queryKey: plantDirectoryKeys.assets(unit.id),
    enabled,
    staleTime: DIRECTORY_STALE_MS,
    queryFn: ({ signal }) =>
      allPages<DirectoryAsset>('/assets', { unitIds: [unit.id], status: 'active', sort: 'name' }, { tenantId, signal }),
  });
}
