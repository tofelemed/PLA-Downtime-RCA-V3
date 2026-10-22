import { useEffect } from 'react';
import type { CreateSiteInput, RenameSiteInput, SiteV2View } from '../types/sites';
import { adminCall, useAdminCommand } from './administration-shared';
import { flattenPages, useV2InfiniteList } from './use-v2-list';

/** Change notice of a site command: refreshes the site lists and the units (their site names). */
const SITE = 'site';

/**
 * Every site of the acting plant with its unit count (a handful; further keyset pages load until the list is
 * complete). Keyed apart from `useSites` (the shell's bootstrap view without unit counts).
 */
export function useSiteList(enabled = true) {
  const list = useV2InfiniteList<SiteV2View>({ resource: 'sites', path: '/sites', query: { limit: 100 }, key: { filters: { view: 'manage' } }, enabled });
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isError } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);
  return { ...list, items: flattenPages(list.data?.pages) };
}

/** `POST /v2/sites` in the acting plant (409 when the name is taken). */
export function useCreateSite() {
  return useAdminCommand<CreateSiteInput, SiteV2View>(SITE, (body, idempotencyKey) => adminCall('POST', '/sites', { body, idempotencyKey }));
}

/** `PATCH /v2/sites/:id` with the new name. */
export function useRenameSite() {
  return useAdminCommand<{ id: string; body: RenameSiteInput }, SiteV2View>(SITE, ({ id, body }) => adminCall('PATCH', `/sites/${id}`, { body }));
}
