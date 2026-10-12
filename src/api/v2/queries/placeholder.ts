/**
 * `placeholderData` policies of the shared query factories (keepPreviousData, docs/UI_UX_AUDIT.md §4):
 * while a filtered list or report refetches under a new key, the previous result stays on screen
 * (with a "refreshing" bar) instead of a skeleton. The previous result is kept only when it belongs to
 * the same tenant (and, for entity reads, the same entity), so a plant switch never shows another
 * plant's data and opening another record never shows the previous record.
 *
 * Usage: `placeholderData: (previous, previousQuery) => (sameTenantQuery(tenantId, previousQuery) ? previous : undefined)`.
 */
type KeyedQuery = { queryKey: readonly unknown[] } | undefined;

/** Key position of the tenant in every v2 key (`['v2', tenantId, resource, ...]`). */
const TENANT_INDEX = 1;
/** Key position of the entity id in detail keys (`['v2', tenant, resource, 'detail', id, variant]`). */
const DETAIL_ID_INDEX = 4;

/** Whether the previous query belongs to the acting tenant (lists, reports). */
export function sameTenantQuery(tenantId: string | null, previousQuery: KeyedQuery): boolean {
  return Boolean(tenantId) && previousQuery?.queryKey[TENANT_INDEX] === tenantId;
}

/** Whether the previous query is a read of the same tenant and entity (view toggles of one record). */
export function sameEntityQuery(tenantId: string | null, entityId: string | null, previousQuery: KeyedQuery): boolean {
  return Boolean(entityId) && sameTenantQuery(tenantId, previousQuery) && previousQuery?.queryKey[DETAIL_ID_INDEX] === entityId;
}
