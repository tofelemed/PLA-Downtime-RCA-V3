import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { customAttributeService } from '@/services/CustomAttributeService';
import type { CustomAttributeDefinition, CustomAttributeValue, EntityType } from '@/types/CustomAttributes';

/** Attribute definitions change rarely; values change through this screen (invalidated on save). */
const STALE_MS = 5 * 60_000;

export interface AttributeRow {
  definition: CustomAttributeDefinition;
  value: string;
}

const keyOf = (tenantId: string | null, entityType: EntityType, entityId: string) =>
  ['v1', tenantId ?? '-', 'custom-attributes', entityType, entityId] as const;

/**
 * The custom attributes that apply to one unit or asset of the plant, with the record's values (v1
 * `/custom-attribute-definitions` and `/custom-attribute-values`; no v2 value API exists yet). Inactive
 * definitions are left out.
 */
export function useCustomAttributes(entityType: EntityType, entityId: string, organizationId?: string) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: keyOf(tenantId, entityType, entityId),
    enabled: Boolean(tenantId),
    staleTime: STALE_MS,
    queryFn: async (): Promise<AttributeRow[]> => {
      const [definitions, values] = await Promise.all([
        customAttributeService.getAttributeDefinitions(entityType, tenantId ?? undefined, organizationId),
        customAttributeService.getAttributeValues(entityId, entityType),
      ]);
      return definitions.filter((definition) => definition.isActive).map((definition) => ({
        definition,
        value: valueOf(values, definition.id),
      }));
    },
  });
}

function valueOf(values: CustomAttributeValue[], definitionId: string): string {
  return values.find((entry) => entry.attributeDefinitionId === definitionId)?.value ?? '';
}

/** Sets (creates or updates) one attribute value of the record. */
export function useSetCustomAttribute(entityType: EntityType, entityId: string) {
  const tenantId = useV2TenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ definitionId, value }: { definitionId: string; value: string }) =>
      customAttributeService.setAttributeValue(entityId, entityType, definitionId, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keyOf(tenantId, entityType, entityId) }),
  });
}
