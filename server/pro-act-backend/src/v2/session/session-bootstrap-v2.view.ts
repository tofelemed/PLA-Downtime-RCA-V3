import { BrandingV2View } from '../administration/branding/branding-v2.dto';
import {
  OrganizationV2View,
  PlantDetailV2View,
  PlantV2View,
} from '../administration/hierarchy/hierarchy-v2.view';
import { SiteV2View } from '../sites/site-v2.view';
import { ListResponse } from '../common/response';
import { FeatureFlagsV2View } from '../feature-flags/feature-flags-v2.controller';

/** `GET /v2/session/bootstrap`: each part is exactly the body of the endpoint it replaces on page load. */
export interface SessionBootstrapV2View {
  /** = `GET /v2/branding` */
  branding: BrandingV2View;
  /** = `GET /v2/feature-flags` */
  featureFlags: FeatureFlagsV2View;
  /** = `GET /v2/notifications/unread-count` */
  unreadNotifications: { unread: number };
  /** = `GET /v2/sites?limit=100` */
  sites: ListResponse<SiteV2View>;
  /** = `GET /v2/tenants/{acting tenant}` */
  plant: PlantDetailV2View;
  /** = every page of `GET /v2/organizations` and `GET /v2/tenants` (plant selector) */
  directory: { organizations: OrganizationV2View[]; plants: PlantV2View[] };
}
