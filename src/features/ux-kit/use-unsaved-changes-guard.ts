import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export const DEFAULT_UNSAVED_MESSAGE = 'You have unsaved changes. Leave this page and discard them?';

/**
 * Whether a form's values differ from what it started with (plain data: strings, numbers, arrays, nested
 * objects built the same way). For forms without their own dirty flag.
 */
export function valuesDiffer(current: unknown, initial: unknown): boolean {
  return JSON.stringify(current) !== JSON.stringify(initial);
}

/**
 * `valuesDiffer`, unless one of `paused` holds (read-only form, save in flight): the usual `isDirty`
 * argument of `useUnsavedChangesGuard` for forms without their own dirty flag.
 *
 * @example useUnsavedChangesGuard(hasUnsavedChanges(values, initial, [readOnly, saving]));
 */
export function hasUnsavedChanges(current: unknown, initial: unknown, paused: readonly boolean[] = []): boolean {
  return !paused.some(Boolean) && valuesDiffer(current, initial);
}

interface HistoryIndexState {
  idx?: unknown;
}

function historyIndex(): number | null {
  const state = window.history.state as HistoryIndexState | null;
  return typeof state?.idx === 'number' ? state.idx : null;
}

/** A plain left click (no modifier: those open a new tab or window, which leaves the form alone). */
function isPlainClick(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

/** The anchor the click follows in this tab (not a download, no other `target`). */
function anchorOf(event: MouseEvent): HTMLAnchorElement | null {
  const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download')) return null;
  return !anchor.target || anchor.target === '_self' ? anchor : null;
}

/** An in-app link the router would handle: same origin, another page (path or query), plain click. */
function inAppHref(event: MouseEvent): string | null {
  const anchor = isPlainClick(event) ? anchorOf(event) : null;
  if (!anchor) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  const current = window.location.pathname + window.location.search;
  return url.pathname + url.search === current ? null : url.href;
}

function useLinkClickGuard(active: boolean, message: string): void {
  useEffect(() => {
    if (!active) return undefined;
    const onClick = (event: MouseEvent) => {
      if (!inAppHref(event) || window.confirm(message)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active, message]);
}

/**
 * Back / forward: a capture listener on `window` runs before the router's own `popstate` listener, so a
 * declined prompt stops the event (the router never sees it) and steps history back to where it was.
 */
function usePopStateGuard(active: boolean, message: string): void {
  const restoring = useRef(false);
  const lastIndex = useRef<number | null>(null);
  const { key } = useLocation();
  useEffect(() => {
    lastIndex.current = historyIndex();
  }, [key]);
  useEffect(() => {
    if (!active) return undefined;
    const onPopState = (event: PopStateEvent) => {
      if (restoring.current) {
        restoring.current = false;
        event.stopImmediatePropagation();
        return;
      }
      const nextIndex = historyIndex();
      if (window.confirm(message)) return;
      event.stopImmediatePropagation();
      const previous = lastIndex.current;
      if (previous === null || nextIndex === null || previous === nextIndex) return;
      restoring.current = true;
      window.history.go(previous - nextIndex);
    };
    window.addEventListener('popstate', onPopState, true);
    return () => window.removeEventListener('popstate', onPopState, true);
  }, [active, message]);
}

function useBeforeUnloadGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);
}

/**
 * Asks before leaving a form with unsaved edits: in-app link clicks and back/forward get a confirm
 * prompt, closing or reloading the tab gets the browser's own prompt. Programmatic `navigate()` (e.g.
 * after a successful save) is not intercepted. Needs a router; works under `<BrowserRouter>` and `<MemoryRouter>`
 * (react-router's `useBlocker` needs a data router, which this app does not use).
 *
 * @example useUnsavedChangesGuard(form.formState.isDirty);
 */
export function useUnsavedChangesGuard(isDirty: boolean, message: string = DEFAULT_UNSAVED_MESSAGE): void {
  useLinkClickGuard(isDirty, message);
  usePopStateGuard(isDirty, message);
  useBeforeUnloadGuard(isDirty);
}
