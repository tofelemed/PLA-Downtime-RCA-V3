/**
 * Last ETag seen per tenant and resource path (API02). Revisioned GETs record it; PATCH/PUT send it as
 * `If-Match` unless the caller passes an explicit revision. Cleared together with the query cache.
 */
const etags = new Map<string, string>();

const keyOf = (tenantId: string | null, path: string) => `${tenantId ?? '-'}|${path}`;

export const etagCache = {
  remember(tenantId: string | null, path: string, etag: string | null): void {
    if (etag) etags.set(keyOf(tenantId, path), etag);
  },
  lookup(tenantId: string | null, path: string): string | undefined {
    return etags.get(keyOf(tenantId, path));
  },
  clear(): void {
    etags.clear();
  },
};

/** `If-Match` value for a numeric row version. */
export function ifMatchOf(revision: number): string {
  return `"${revision}"`;
}
