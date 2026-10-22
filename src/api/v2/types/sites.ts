/**
 * Sites of the acting plant (`GET /v2/sites`, backend `src/v2/sites`, Setup UX fixes Phase 1). Hand-written
 * like the other v2 views: the OpenAPI snapshot does not describe response bodies.
 */
export interface SiteV2View {
  id: string;
  name: string;
  /** IANA time zone */
  timezone: string;
  /** start of the operational day, HH:MM */
  operationalDayStart: string;
  isDefault: boolean;
  /** units placed on this site */
  unitCount: number;
}

/** `POST /v2/sites`: exactly these fields (the server refuses any other). */
export interface CreateSiteInput {
  name: string;
  timezone?: string;
  operationalDayStart?: string;
}

/** `PATCH /v2/sites/:id`: a rename. */
export interface RenameSiteInput {
  name: string;
}
