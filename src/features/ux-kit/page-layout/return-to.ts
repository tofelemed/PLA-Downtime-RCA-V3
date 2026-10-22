import { useLocation } from 'react-router-dom';

/** Query parameter a list page hands to its sub-pages: its own address, filters and tab included. */
export const RETURN_PARAM = 'back';

const pathOf = (to: string) => to.split(/[?#]/)[0];
const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/**
 * `path` with `?back=<returnTo>` added (its own query kept), so the sub-page's Back and Cancel return to the
 * list as the user left it.
 *
 * @example withReturnTo('/planning/profiles/p1', '/setup/profiles?unitId=u1') // '/planning/profiles/p1?back=%2Fsetup%2Fprofiles%3FunitId%3Du1'
 */
export function withReturnTo(path: string, returnTo: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${RETURN_PARAM}=${encodeURIComponent(returnTo)}`;
}

/**
 * The `back` address of a query when it is an in-app path under one of `prefixes` (never another site or an
 * arbitrary page); null otherwise.
 */
export function returnTargetOf(search: string, prefixes: readonly string[]): string | null {
  const target = new URLSearchParams(search).get(RETURN_PARAM);
  if (!target || !target.startsWith('/') || target.startsWith('//')) return null;
  const path = pathOf(target);
  return prefixes.some((prefix) => under(path, prefix)) ? target : null;
}

/** The page's `back` address (see `returnTargetOf`), else `fallback`. */
export function useReturnTo(fallback: string, prefixes: readonly string[]): string {
  return returnTargetOf(useLocation().search, prefixes) ?? fallback;
}

/** The current address (path and query) for a link that should come back here. */
export function useCurrentAddress(): string {
  const { pathname, search } = useLocation();
  return `${pathname}${search}`;
}
