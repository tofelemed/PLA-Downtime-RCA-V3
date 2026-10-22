import { Injectable } from '@nestjs/common';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { BrandingV2Service } from '../administration/branding/branding-v2.service';
import { HierarchyEditV2Service } from '../administration/hierarchy/hierarchy-edit-v2.service';
import { HierarchyV2Service } from '../administration/hierarchy/hierarchy-v2.service';
import { SitesV2Service } from '../sites/sites-v2.service';
import { ListResponse } from '../common/response';
import { SessionBootstrapV2View } from './session-bootstrap-v2.view';

/** Directory pages are read like the header does (pages of 500 until the last). */
const DIRECTORY_PAGE = 500;
/** Sites list of the shell (plant timezone): the first 100, as `GET /v2/sites?limit=100`. */
const SITES_LIMIT = 100;

async function allPages<T>(
  page: (cursor?: string) => Promise<ListResponse<T>>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const next = await page(cursor);
    items.push(...next.items);
    cursor = next.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

/**
 * Everything the app shell reads on every page, in one request (perf audit P08): the same views as
 * `GET /v2/branding`, `/v2/feature-flags`, `/v2/notifications/unread-count`, `/v2/sites?limit=100`,
 * `/v2/tenants/{acting tenant}` and every page of `/v2/organizations` and `/v2/tenants`, built by the same
 * services for the same caller. Read only; each part keeps its own scoping and money/role rules.
 */
@Injectable()
export class SessionBootstrapV2Service {
  constructor(
    private readonly branding: BrandingV2Service,
    private readonly flags: FeatureFlagsService,
    private readonly notifications: NotificationsService,
    private readonly sites: SitesV2Service,
    private readonly hierarchy: HierarchyV2Service,
    private readonly plants: HierarchyEditV2Service,
  ) {}

  async bootstrap(context: RequestContext): Promise<SessionBootstrapV2View> {
    const tenantId = requireTenantId(context);
    const [
      branding,
      flags,
      unread,
      sites,
      plant,
      organizations,
      directoryPlants,
    ] = await Promise.all([
      this.branding.get(context),
      this.flags.list(context),
      this.notifications.unreadCount(context),
      this.sites.list(context, { limit: SITES_LIMIT }),
      this.plants.getPlant(context, tenantId),
      allPages((cursor) =>
        this.hierarchy.listOrganizations(context, {
          limit: DIRECTORY_PAGE,
          cursor,
        }),
      ),
      allPages((cursor) =>
        this.hierarchy.listPlants(context, { limit: DIRECTORY_PAGE, cursor }),
      ),
    ]);
    return {
      branding,
      featureFlags: {
        items: flags,
        asOf: new Date().toISOString(),
        scope: { tenantId },
      },
      unreadNotifications: { unread },
      sites,
      plant,
      directory: { organizations, plants: directoryPlants },
    };
  }
}
