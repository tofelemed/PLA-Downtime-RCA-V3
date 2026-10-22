import { useCallback, useEffect, useRef, useState } from 'react';
import { createLogger } from '@/lib/logger';
import { NAV_SECTIONS, type NavSectionKey } from './navigation-items';

const log = createLogger('nav-state');
const KEY_PREFIX = 'proact.nav.';

/** Sidebar view preference of one user in this browser (like the plant selection store). */
export interface NavState {
  /** icon rail instead of the full sidebar; the default, so e2e and first visits start collapsed */
  collapsed: boolean;
  /** sections the user closed; every other section is open (new sections start open) */
  closedSections: NavSectionKey[];
}

export const DEFAULT_NAV_STATE: NavState = { collapsed: true, closedSections: [] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Parsed stored state; anything unreadable falls back to the defaults. */
export function parseNavState(raw: string | null): NavState {
  if (!raw) return DEFAULT_NAV_STATE;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return DEFAULT_NAV_STATE;
    const closed = Array.isArray(value.closedSections) ? value.closedSections.filter((key): key is NavSectionKey => typeof key === 'string') : [];
    return { collapsed: value.collapsed !== false, closedSections: closed };
  } catch {
    return DEFAULT_NAV_STATE;
  }
}

export function loadNavState(userId: string | null): NavState {
  if (!userId) return DEFAULT_NAV_STATE;
  try {
    return parseNavState(window.localStorage.getItem(KEY_PREFIX + userId));
  } catch (error: unknown) {
    log.warn('Navigation preference not readable; using defaults', error);
    return DEFAULT_NAV_STATE;
  }
}

export function saveNavState(userId: string | null, state: NavState): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(state));
  } catch (error: unknown) {
    log.warn('Navigation preference not saved', error);
  }
}

export interface NavStateApi extends NavState {
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  isSectionOpen: (section: NavSectionKey) => boolean;
  toggleSection: (section: NavSectionKey) => void;
  /**
   * Accordion on navigation: opens `section` and closes every other one, once per change of the focused
   * section (calling it again for the same section is a no-op, so a manual close of it sticks).
   */
  focusSection: (section: NavSectionKey) => void;
}

/** `{collapsed, closedSections}` of the signed-in user, persisted per user in localStorage (guarded). */
export function useNavState(userId: string | null): NavStateApi {
  const [state, setState] = useState<NavState>(() => loadNavState(userId));
  // the section last focused in this page load (not persisted: a reload opens the current page's section)
  const focused = useRef<NavSectionKey | null>(null);
  useEffect(() => {
    focused.current = null;
    setState(loadNavState(userId));
  }, [userId]);

  const update = useCallback(
    (next: (previous: NavState) => NavState) =>
      setState((previous) => {
        const value = next(previous);
        saveNavState(userId, value);
        return value;
      }),
    [userId],
  );
  const setCollapsed = useCallback((collapsed: boolean) => update((s) => ({ ...s, collapsed })), [update]);
  const toggleCollapsed = useCallback(() => update((s) => ({ ...s, collapsed: !s.collapsed })), [update]);
  const toggleSection = useCallback(
    (section: NavSectionKey) =>
      update((s) => ({
        ...s,
        closedSections: s.closedSections.includes(section)
          ? s.closedSections.filter((key) => key !== section)
          : [...s.closedSections, section],
      })),
    [update],
  );
  const focusSection = useCallback(
    (section: NavSectionKey) => {
      if (focused.current === section) return;
      focused.current = section;
      update((s) => ({ ...s, closedSections: NAV_SECTIONS.map((entry) => entry.key).filter((key) => key !== section) }));
    },
    [update],
  );
  const isSectionOpen = useCallback((section: NavSectionKey) => !state.closedSections.includes(section), [state.closedSections]);
  return { ...state, setCollapsed, toggleCollapsed, isSectionOpen, toggleSection, focusSection };
}
