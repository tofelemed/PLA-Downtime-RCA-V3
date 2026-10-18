import { adminCall } from '@/api/v2/queries/administration-shared';
import type { ListResponse } from '@/api/v2/types/envelopes';
import type { UserDirectoryEntry } from '@/api/v2/types/administration';

/** The server answers at most 100 ids per `GET /v2/users/directory?ids=` call. */
const IDS_PER_CALL = 100;

interface Batch {
  ids: Set<string>;
  result: Promise<ReadonlyMap<string, string>>;
}

/** One open batch per tenant: ids asked for during the same tick share one request. */
const openBatches = new Map<string, Batch>();

async function fetchNames(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const names = new Map<string, string>();
  for (let start = 0; start < ids.length; start += IDS_PER_CALL) {
    const chunk = ids.slice(start, start + IDS_PER_CALL);
    const page = await adminCall<ListResponse<UserDirectoryEntry>>('GET', '/users/directory', { query: { ids: chunk } });
    for (const entry of page.items) {
      const name = entry.name?.trim();
      if (name) names.set(entry.id, name);
    }
  }
  return names;
}

function openBatch(tenantId: string): Batch {
  const ids = new Set<string>();
  const result = Promise.resolve().then(() => {
    openBatches.delete(tenantId);
    return fetchNames([...ids].sort());
  });
  const batch = { ids, result };
  openBatches.set(tenantId, batch);
  return batch;
}

/**
 * The display name of one user id, or null when the directory does not know it (a former member, or a user
 * of another plant). Lookups of the same tick are batched into one directory request per tenant, so a
 * table of 50 rows costs one call, not 50 (CLAUDE.md: no N+1). Callers cache the answer per id
 * (TanStack Query, `usePersonLookups`).
 */
export function loadPersonName(tenantId: string, id: string): Promise<string | null> {
  const batch = openBatches.get(tenantId) ?? openBatch(tenantId);
  batch.ids.add(id);
  return batch.result.then((names) => names.get(id) ?? null);
}
