import type { ListResponse } from '../types/envelopes';
import type {
  AttributeDefinitionInput,
  AttributeDefinitionView,
  BrandingInput,
  BrandingView,
  CreateOrganizationInput,
  CreatePlantInput,
  OrganizationView,
  PlantView,
} from '../types/administration';
import { adminCall, compactQuery, useAdminCommand, useAdminRead, useAdminRecord } from './administration-shared';
import { usePagedQuery } from './use-paged-query';

const CONFIG = 'admin_config';

/** Custom attribute definitions of one hierarchy level, in display order, 20 per page. */
export function useAttributeDefinitionsPage(entityType: string) {
  const query = compactQuery({ entityType });
  return usePagedQuery<AttributeDefinitionView>({
    resource: 'admin-config',
    path: '/custom-attribute-definitions',
    query,
    key: { filters: { definitions: query } },
  });
}

export const useAttributeDefinition = (id: string | null | undefined) =>
  useAdminRecord<AttributeDefinitionView>('admin-config', id, `/custom-attribute-definitions/${id ?? ''}`, 'attribute');

export function useCreateAttribute() {
  return useAdminCommand<AttributeDefinitionInput, AttributeDefinitionView>(CONFIG, (body, idempotencyKey) =>
    adminCall('POST', '/custom-attribute-definitions', { body, idempotencyKey }),
  );
}

export function useUpdateAttribute() {
  return useAdminCommand<{ id: string; body: AttributeDefinitionInput }, AttributeDefinitionView>(CONFIG, ({ id, body }) =>
    adminCall('PATCH', `/custom-attribute-definitions/${id}`, { body }),
  );
}

export function useDeleteAttribute() {
  return useAdminCommand<string, void>(CONFIG, (id) => adminCall('DELETE', `/custom-attribute-definitions/${id}`));
}

/** Organizations within reach (a handful; the first 500 by name). */
export const useOrganizations = () =>
  useAdminRead<ListResponse<OrganizationView>>('admin-config', '/organizations', { limit: 500 });

/** Plants within reach, 20 per page, by name. */
export function usePlantsPage(organizationId?: string) {
  const query = compactQuery({ organizationId });
  return usePagedQuery<PlantView>({ resource: 'admin-config', path: '/tenants', query, key: { filters: { plants: query } } });
}

/** Plants within reach as a lookup for selects (first 500 by name). */
export const usePlantOptions = (enabled = true) =>
  useAdminRead<ListResponse<PlantView>>('admin-config', '/tenants', { limit: 500 }, enabled);

export const usePlant = (id: string | null | undefined) => useAdminRecord<PlantView>('admin-config', id, `/tenants/${id ?? ''}`, 'plant');

export function useCreateOrganization() {
  return useAdminCommand<CreateOrganizationInput, OrganizationView>(CONFIG, (body, idempotencyKey) =>
    adminCall('POST', '/organizations', { body, idempotencyKey }),
  );
}

export function useDeleteOrganization() {
  return useAdminCommand<string, void>(CONFIG, (id) => adminCall('DELETE', `/organizations/${id}`));
}

export function useCreatePlant() {
  return useAdminCommand<CreatePlantInput, PlantView>(CONFIG, (body, idempotencyKey) => adminCall('POST', '/tenants', { body, idempotencyKey }));
}

export function useDeletePlant() {
  return useAdminCommand<string, void>(CONFIG, (id) => adminCall('DELETE', `/tenants/${id}`));
}

export const useBranding = () => useAdminRead<BrandingView>('admin-config', '/branding');

export function useSaveBranding() {
  return useAdminCommand<BrandingInput, BrandingView>(CONFIG, (body) => adminCall('PUT', '/branding', { body }));
}

export function useResetBranding() {
  return useAdminCommand<void, BrandingView>(CONFIG, () => adminCall('DELETE', '/branding'));
}
