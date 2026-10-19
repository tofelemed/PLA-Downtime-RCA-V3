import { matchPath } from 'react-router-dom';
import type { Capabilities } from '@/features/auth/capabilities';
import { activeNavItem, NAVIGATION_ITEMS, type NavigationItem } from '@/features/auth/navigation-items';
import type { AppRoute } from './route-types';

/**
 * Fills `requires` / `gateTitle` of each route from the menu item its path belongs to (longest match,
 * like the menu highlight): `/plans/:planId` needs what "Plans, Profiles & Calendars" needs. A route
 * that names `requires` itself keeps it; a path outside the menu (redirects, dev pages) stays open.
 */
export function withMenuGates(routes: readonly AppRoute[], items: readonly NavigationItem[] = NAVIGATION_ITEMS): AppRoute[] {
  return routes.map((route) => {
    const item = activeNavItem(items, route.path);
    if (!item) return route;
    return { ...route, requires: route.requires ?? item.capability, gateTitle: route.gateTitle ?? item.name };
  });
}

/** Static segments rank before `:params`, so `/connectivity/connections/new` is not read as `:connectionId`. */
function specificity(path: string): number {
  return path.split('/').filter((segment) => segment && !segment.startsWith(':') && segment !== '*').length;
}

/**
 * The route `pathname` (no query or hash) opens, most specific first; undefined outside the routes. Used to
 * judge whether a breadcrumb or back link leads somewhere the user may go (QA_MASTERDATA L23).
 */
export function routeOfPath(pathname: string, routes: readonly AppRoute[]): AppRoute | undefined {
  return routes
    .filter((route) => matchPath({ path: route.path, end: true }, pathname))
    .sort((a, b) => specificity(b.path) - specificity(a.path))[0];
}

/** Whether `to` opens for these capabilities: its route's gate is held, or it has none; unknown paths count as open. */
export function canReachPath(to: string, capabilities: Capabilities, routes: readonly AppRoute[]): boolean {
  const route = routeOfPath(to.split(/[?#]/)[0], routes);
  return !route?.requires || capabilities[route.requires];
}
