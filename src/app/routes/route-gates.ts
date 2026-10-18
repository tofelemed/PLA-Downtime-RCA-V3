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
