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
  const module = { label: item.name, to: item.href };
  if (!back) return { crumbs: [module], keepBack: false };
  if (navMatchLength(item, pathOf(back.to)) === 0) return { crumbs: [module], keepBack: true };
  // the back target is the module page itself (same name, or exactly its address outside Setup): one crumb, keeping
  // its filters / words; a Setup area always shows its own name first (its first tab is one of several pages)
  const collapse = sameLabel(back.label, item.name) || (back.to === item.href && item.section !== 'setup');
  if (collapse) return { crumbs: [{ label: back.label, to: back.to }], keepBack: false };
  // a Setup area whose first list is the parent: the area's name as text, so the same address is not linked twice
  const area = back.to === item.href ? { label: item.name } : module;
  return { crumbs: [area, { label: back.label, to: back.to }], keepBack: false };
}

/** The first page of a Setup area (e.g. Production units of "Plant & equipment"): Area › page, like its siblings. */
function setupHomeTrail(item: NavigationItem, title: string): RouteTrail | null {
  if (item.section !== 'setup') return null;
  const crumbs = dedupeCrumbs([{ label: item.name, to: item.href }, { label: title }]);
  return crumbs.length > 1 ? { crumbs, keepBack: false } : null;
}

/**
 * UX audit B-3: Module › parent › page, derived from the route instead of typed per page. The module is
 * the menu item the path belongs to (longest match), the parent is the page's own `back` link. Module
 * pages themselves (depth 1) and paths outside the menu get no trail (null), except a Setup area's first
 * page whose title is not the area's name (SETUP_UX_FIXES Phase 3).
 */
export function routeTrail(pathname: string, title: string, back: BackTarget | undefined, items: readonly NavigationItem[] = NAVIGATION_ITEMS): RouteTrail | null {
  const item = activeNavItem(items, pathname);
  if (!item) return null;
  if (pathname === item.href) return setupHomeTrail(item, title);
  const { crumbs, keepBack } = moduleCrumbs(item, back);
  return { crumbs: dedupeCrumbs([...crumbs, { label: title }]), keepBack };
}

/** Whether the path is a page of the sidebar's Setup section (its sub-pages show a visible Back button). */
export function isSetupPath(pathname: string, items: readonly NavigationItem[] = NAVIGATION_ITEMS): boolean {
  return activeNavItem(items, pathname)?.section === 'setup';
}
