import { useEffect, useSyncExternalStore } from 'react';

/** Product name used until the branding (`GET /v2/branding`) names the app. */
export const APP_TITLE = 'Traverse Forge';

let current = APP_TITLE;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => current;

function setAppName(name: string | null | undefined): void {
  const next = name?.trim() || APP_TITLE;
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

/** The app name of the branding, or `APP_TITLE` before branding loads / when it names none. */
export function useAppName(): string {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Called once by the app shell with the branding's app name; tab titles follow it. */
export function useSyncAppName(name: string | null | undefined): void {
  useEffect(() => setAppName(name), [name]);
}
