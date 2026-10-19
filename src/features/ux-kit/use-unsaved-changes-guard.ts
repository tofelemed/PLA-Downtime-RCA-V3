import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hasLeaveHost, requestLeave } from './leave-confirmation';

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
  const target = url.pathname + url.search;
  return target === current ? null : target + url.hash;
}

/**
 * In-app link clicks: with the app's dialog mounted the click is held, the dialog asks, and leaving
 * navigates through the router; without it the browser's `confirm()` answers synchronously.
 */
function useLinkClickGuard(active: boolean, message: string): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (!active) return undefined;
    const onClick = (event: MouseEvent) => {
      const target = inAppHref(event);
      if (!target) return;
      const withDialog = hasLeaveHost();
      if (!withDialog && window.confirm(message)) return;
      event.preventDefault();
      event.stopPropagation();
      if (withDialog) void requestLeave(message).then((leave) => leave && navigate(target));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active, message, navigate]);
}

interface HistoryFlags {
  /** the next popstate is our own step back: swallow it */
  restoring: boolean;
  /** the next popstate is the confirmed navigation: let the router have it */
  passing: boolean;
}

/** The browser's synchronous `confirm()` (no dialog host, or history indices unknown). */
function askNatively(event: PopStateEvent, message: string, flags: HistoryFlags, step: number | null): void {
  if (window.confirm(message)) return;
  event.stopImmediatePropagation();
  if (step === null || step === 0) return;
  flags.restoring = true;
  window.history.go(-step);
}

/** The app dialog: history is stepped back at once (the page stays), and stepped on again when the user leaves. */
function askWithDialog(event: PopStateEvent, message: string, flags: HistoryFlags, step: number): void {
  event.stopImmediatePropagation();
  flags.restoring = true;
  window.history.go(-step);
  void requestLeave(message).then((leave) => {
    if (!leave) return;
    flags.passing = true;
    window.history.go(step);
  });
}

/** Our own history moves (`restoring`, `passing`); true when the event is handled. */
function consumeOwnMove(event: PopStateEvent, flags: HistoryFlags): boolean {
  if (flags.restoring) {
    flags.restoring = false;
    event.stopImmediatePropagation();
    return true;
  }
  if (!flags.passing) return false;
  flags.passing = false;
  return true;
}

/**
 * Back / forward: a capture listener on `window` runs before the router's own `popstate` listener, so a
 * declined prompt stops the event (the router never sees it) and steps history back to where it was.
 */
function usePopStateGuard(active: boolean, message: string): void {
  const flags = useRef<HistoryFlags>({ restoring: false, passing: false });
  const lastIndex = useRef<number | null>(null);
  const { key } = useLocation();
  useEffect(() => {
    lastIndex.current = historyIndex();
  }, [key]);
  useEffect(() => {
    if (!active) return undefined;
    const onPopState = (event: PopStateEvent) => {
      if (consumeOwnMove(event, flags.current)) return;
      const next = historyIndex();
      const step = next === null || lastIndex.current === null ? null : next - lastIndex.current;
      if (hasLeaveHost() && step) askWithDialog(event, message, flags.current, step);
      else askNatively(event, message, flags.current, step);
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
 * Asks before leaving a form with unsaved edits: in-app link clicks and back/forward ask through the
 * app's dialog (`UnsavedChangesDialogHost`; the browser's `confirm()` when no host is mounted), closing
 * or reloading the tab gets the browser's own prompt. Programmatic `navigate()` (e.g. after a
 * successful save) is not intercepted; a Cancel button that navigates in code awaits the returned
 * `confirmLeave()` first. Needs a router; works under `<BrowserRouter>` and `<MemoryRouter>`
 * (react-router's `useBlocker` needs a data router, which this app does not use).
 *
 * @example useUnsavedChangesGuard(form.formState.isDirty);
 */
export function useUnsavedChangesGuard(
  isDirty: boolean,
  message: string = DEFAULT_UNSAVED_MESSAGE,
): { confirmLeave: () => Promise<boolean> } {
  useLinkClickGuard(isDirty, message);
  usePopStateGuard(isDirty, message);
  useBeforeUnloadGuard(isDirty);
  const confirmLeave = useCallback(async () => {
    if (!isDirty) return true;
    return hasLeaveHost() ? requestLeave(message) : window.confirm(message);
  }, [isDirty, message]);
  return { confirmLeave };
}
