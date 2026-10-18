import { activeNavItem, navMatchLength, NAVIGATION_ITEMS, type NavigationItem } from '@/features/auth/navigation-items';

/** One step of a breadcrumb trail; the last one (the page itself) has no `to`. */
export interface Crumb {
  label: string;
  to?: string;
}

export interface BackTarget {
  to: string;
  label: string;
}

/** The automatic trail and whether the page's own back link still has to be shown next to it. */
export interface RouteTrail {
  crumbs: Crumb[];
  /** the back link goes outside the module (e.g. "Downtime Analysis" from an event page): keep it */
  keepBack: boolean;
}

const pathOf = (to: string) => to.split(/[?#]/)[0];

function moduleCrumbs(item: NavigationItem, back: BackTarget | undefined): { crumbs: Crumb[]; keepBack: boolean } {
  if (!back) return { crumbs: [{ label: item.name, to: item.href }], keepBack: false };
  if (navMatchLength(item, pathOf(back.to)) === 0) return { crumbs: [{ label: item.name, to: item.href }], keepBack: true };
  // the back target is the module page itself (same name, or exactly its address): one crumb, keeping its filters / words
  if (back.label === item.name || back.to === item.href) return { crumbs: [{ label: back.label, to: back.to }], keepBack: false };
  return { crumbs: [{ label: item.name, to: item.href }, { label: back.label, to: back.to }], keepBack: false };
}

/**
 * UX audit B-3: Module › parent › page, derived from the route instead of typed per page. The module is
 * the menu item the path belongs to (longest match), the parent is the page's own `back` link. Module
 * pages themselves (depth 1) and paths outside the menu get no trail (null).
 */
export function routeTrail(pathname: string, title: string, back: BackTarget | undefined, items: readonly NavigationItem[] = NAVIGATION_ITEMS): RouteTrail | null {
  const item = activeNavItem(items, pathname);
  if (!item || pathname === item.href) return null;
  const { crumbs, keepBack } = moduleCrumbs(item, back);
  return { crumbs: [...crumbs, { label: title }], keepBack };
}
