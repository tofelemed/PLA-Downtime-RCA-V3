/** `GET /api/v2/feature-flags` (backend `src/v2/feature-flags/feature-flags-v2.controller.ts`). */
export type FeatureFlagKey =
  | 'v2.eventHub'
  | 'v2.downtimeAnalysis'
  | 'v2.plansProfilesCalendars'
  | 'v2.planDashboard'
  | 'v2.plaAnalytics'
  | 'v2.integrationConsole'
  | 'v2.codesAdmin'
  | 'v2.rca';

export interface FeatureFlagState {
  key: FeatureFlagKey;
  enabled: boolean;
  overridden: boolean;
  updatedAt: string | null;
}

export interface FeatureFlagsView {
  items: FeatureFlagState[];
  asOf: string;
  scope: { tenantId: string };
}

export interface SiteView {
  id: string;
  name: string;
  timezone: string;
  timezoneFallback: boolean;
  operationalDayStart: string;
  isDefault: boolean;
}

/** `CodeV2View` (backend `src/code-library/code-view.ts`). */
export interface CodeView {
  id: string;
  library: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  path: string;
  level: number;
  version: number;
  rowVersion: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  active: boolean;
}
