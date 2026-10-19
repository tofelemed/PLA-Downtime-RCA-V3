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
const sameLabel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The same page twice in a row (same address, or the same words in another case) is one step (QA_SHELL). */
function sameStep(a: Crumb, b: Crumb): boolean {
  if (a.to && a.to === b.to) return true;
  return sameLabel(a.label, b.label);
}

/** Consecutive duplicates collapse into the later step (it carries the page's own filters / words). */
export function dedupeCrumbs(crumbs: readonly Crumb[]): Crumb[] {
  return crumbs.reduce<Crumb[]>((kept, crumb) => {
    const previous = kept[kept.length - 1];
    if (previous && sameStep(previous, crumb)) kept[kept.length - 1] = crumb;
    else kept.push(crumb);
    return kept;
  }, []);
}

/** Steps the user cannot open (route gate not held) stay as text, without a link (QA_MASTERDATA L23). */
export function withReach(crumbs: readonly Crumb[], canReach: (to: string) => boolean): Crumb[] {
  return crumbs.map((crumb) => (crumb.to && !canReach(crumb.to) ? { label: crumb.label } : crumb));
}

function moduleCrumbs(item: NavigationItem, back: BackTarget | undefined): { crumbs: Crumb[]; keepBack: boolean } {
  if (!back) return { crumbs: [{ label: item.name, to: item.href }], keepBack: false };
  if (navMatchLength(item, pathOf(back.to)) === 0) return { crumbs: [{ label: item.name, to: item.href }], keepBack: true };
  // the back target is the module page itself (same name, or exactly its address): one crumb, keeping its filters / words
  if (sameLabel(back.label, item.name) || back.to === item.href) return { crumbs: [{ label: back.label, to: back.to }], keepBack: false };
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
  return { crumbs: dedupeCrumbs([...crumbs, { label: title }]), keepBack };
}
