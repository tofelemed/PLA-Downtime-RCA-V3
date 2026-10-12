import { ADMINISTRATION_ROUTES } from './administration';
import { DEV_ROUTES } from './dev';
import { INTEGRATION_ROUTES } from './integration';
import { OVERVIEW_ROUTES } from './overview';
import { PRODUCTION_ROUTES } from './production';
import { RELIABILITY_ROUTES } from './reliability';
import type { AppRoute } from './route-types';

export type { AppRoute } from './route-types';

/** Every protected route, area by area (each area file is owned by one feature track). */
export const PROTECTED_ROUTES: readonly AppRoute[] = [
  ...OVERVIEW_ROUTES,
  ...PRODUCTION_ROUTES,
  ...RELIABILITY_ROUTES,
  ...INTEGRATION_ROUTES,
  ...ADMINISTRATION_ROUTES,
  ...DEV_ROUTES,
];

const preloadByPath = new Map<string, () => Promise<unknown>>();
for (const route of PROTECTED_ROUTES) if (route.preload) preloadByPath.set(route.path, route.preload);

/** Starts downloading the chunk of the page at `href` (menu hover / focus); unknown paths are ignored. */
export function preloadRoute(href: string): void {
  const preload = preloadByPath.get(href);
  if (preload) void preload().catch(() => undefined);
}
