import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { v2Request } from '@/api/v2/client';
import type { AttributeDefinitionView } from '@/api/v2/types/administration';
import type { ListResponse } from '@/api/v2/types/envelopes';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';

/** Attribute definitions change rarely; values change through this screen (invalidated on save). */
const STALE_MS = 5 * 60_000;

export type AttributeRecordType = 'Unit' | 'Asset';

export interface AttributeRow {
  definition: AttributeDefinitionView;
  value: string;
}

interface StoredValue {
  attributeDefinitionId: string;
  value: string;
}

const keyOf = (tenantId: string | null, entityType: AttributeRecordType, entityId: string) =>
  ['v2', tenantId ?? '-', 'custom-attributes', entityType, entityId] as const;

/** Every definition of the record type that applies in the plant (`GET /v2/custom-attribute-definitions`). */
async function definitionsOf(entityType: AttributeRecordType, signal: AbortSignal): Promise<AttributeDefinitionView[]> {
  const all: AttributeDefinitionView[] = [];
  let cursor: string | undefined;
  do {
    const page = (
      await v2Request<ListResponse<AttributeDefinitionView>>({
        method: 'GET',
        path: '/custom-attribute-definitions',
        query: { entityType, limit: 500, cursor },
        signal,
      })
    ).data;
    all.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return all;
}

/**
 * The custom attributes that apply to one unit or asset of the plant, with the record's values (v2
 * `/custom-attribute-definitions` and `/custom-attribute-values`). Inactive definitions are left out.
 */
export function useCustomAttributes(entityType: AttributeRecordType, entityId: string) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: keyOf(tenantId, entityType, entityId),
    enabled: Boolean(tenantId),
    staleTime: STALE_MS,
    queryFn: async ({ signal }): Promise<AttributeRow[]> => {
      const [definitions, values] = await Promise.all([
        definitionsOf(entityType, signal),
        v2Request<StoredValue[]>({ method: 'GET', path: '/custom-attribute-values', query: { entityType, entityId }, signal }),
      ]);
      return definitions
        .filter((definition) => definition.isActive)
        .map((definition) => ({
          definition,
          value: values.data.find((entry) => entry.attributeDefinitionId === definition.id)?.value ?? '',
        }));
    },
  });
}

/** Sets (creates or replaces) one attribute value of the record (`PUT /v2/custom-attribute-values`). */
export function useSetCustomAttribute(entityType: AttributeRecordType, entityId: string) {
  const tenantId = useV2TenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ definitionId, value }: { definitionId: string; value: string }) =>
      v2Request<StoredValue>({
        method: 'PUT',
        path: '/custom-attribute-values',
        body: { entityType, entityId, attributeDefinitionId: definitionId, value },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keyOf(tenantId, entityType, entityId) }),
  });
}
