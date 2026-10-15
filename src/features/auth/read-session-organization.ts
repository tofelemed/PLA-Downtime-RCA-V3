import { v2Request } from '@/api/v2/client';
import type { DirectoryOrganization } from '@/api/v2/types/plant-directory';

interface OrganizationPage {
  items: DirectoryOrganization[];
  nextCursor: string | null;
}

/** The organization directory is paginated; there is no v2 organization detail GET. */
export async function readSessionOrganization(id: string, tenantId?: string): Promise<DirectoryOrganization> {
  let cursor: string | undefined;
  const visited = new Set<string>();
  do {
    const { data } = await v2Request<OrganizationPage>({
      method: 'GET', path: '/organizations', tenantId, query: { limit: 100, cursor },
    });
    const organization = data.items.find((item) => item.id === id);
    if (organization) return organization;
    cursor = data.nextCursor ?? undefined;
    if (cursor && visited.has(cursor)) throw new Error('Organization directory returned a repeated cursor');
    if (cursor) visited.add(cursor);
  } while (cursor);
  throw new Error('Session organization is not accessible');
}
