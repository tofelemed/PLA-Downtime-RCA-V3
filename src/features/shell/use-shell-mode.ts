import { useEffect, useMemo, useState } from 'react';
import type { NavStateApi } from '@/features/auth/use-nav-state';
import { useMediaQuery } from './use-media-query';

/**
 * UX audit H-1: below 1024 px (`lg`) the menu is an off-canvas drawer; 1024–1279 px the icon rail unless
 * the user expands it there; from 1280 px (`xl`) the user's saved preference. Without `matchMedia` the
 * shell behaves as on a wide screen.
 */
export type ShellMode = 'drawer' | 'rail' | 'full';

export function useShellMode(): ShellMode {
  const large = useMediaQuery('(min-width: 1024px)', true);
  const extraLarge = useMediaQuery('(min-width: 1280px)', true);
  if (!large) return 'drawer';
  return extraLarge ? 'full' : 'rail';
}

/**
 * The sidebar state the shell renders: on the rail width it starts collapsed and an expand there lasts
 * for the visit only (the saved wide-screen preference is untouched); in the drawer it is always expanded.
 */
export function useResponsiveNav(nav: NavStateApi, mode: ShellMode): NavStateApi {
  const [railExpanded, setRailExpanded] = useState(false);
  useEffect(() => {
    if (mode !== 'rail') setRailExpanded(false);
  }, [mode]);
  return useMemo(() => {
    if (mode === 'drawer') return { ...nav, collapsed: false };
    if (mode === 'full') return nav;
    return {
      ...nav,
      collapsed: !railExpanded,
      setCollapsed: (collapsed: boolean) => setRailExpanded(!collapsed),
      toggleCollapsed: () => setRailExpanded((expanded) => !expanded),
    };
  }, [nav, mode, railExpanded]);
}
