import { useEffect } from 'react';

/** Product name appended to every browser tab title. */
export const APP_TITLE = 'Traverse Forge';

/**
 * Sets the browser tab title to `${title} · Traverse Forge` while the component is mounted and restores the
 * previous title on unmount. `PageHeader` calls it; use it directly only on pages without a header.
 */
export function useDocumentTitle(title: string, enabled = true): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const previous = document.title;
    document.title = `${title} · ${APP_TITLE}`;
    return () => {
      document.title = previous;
    };
  }, [title, enabled]);
}
