/**
 * Entries of the plant selection (organisation → plant → unit → asset), kept in this browser per user.
 * Structural subsets of the v2 views, so a `GET /v2/organizations` / `GET /v2/tenants` item is one.
 */
export interface DirectoryOrganization {
  id: string;
  code: string;
  name: string;
  /** whether the caller may edit it in the Admin panel (server flag of `GET /v2/organizations`) */
  canEdit?: boolean;
}

export interface DirectoryPlant {
  id: string;
  code: string;
  name: string;
  organizationId: string;
  timezone?: string | null;
  calendarSystem?: string;
  digits?: string;
  weekStart?: string;
  /** whether the caller may edit it in the Admin panel (server flag of `GET /v2/tenants`) */
  canEdit?: boolean;
}

export interface DirectoryUnit {
  id: string;
  code: string;
  name: string;
}

/** One row of `GET /v2/units/asset-presence`. */
export interface UnitAssetPresence {
  unitId: string;
  hasAssets: boolean;
}

export interface DirectoryAsset {
  id: string;
  code: string;
  name: string;
  unitId: string;
}
