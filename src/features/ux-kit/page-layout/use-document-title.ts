import { useEffect } from 'react';
import { useAppName } from './app-name';

export { APP_TITLE } from './app-name';

/**
 * The one place that sets the browser tab title (WCAG 2.4.2): `${title} · <app name>` while the component
 * is mounted, the previous title restored on unmount. The app name comes from the branding (`useAppName`).
 * `PageHeader` calls it; use it directly only on pages without a header.
 */
export function useDocumentTitle(title: string, enabled = true): void {
  const appName = useAppName();
  useEffect(() => {
    if (!enabled) return undefined;
    const previous = document.title;
    document.title = `${title} · ${appName}`;
    return () => {
      document.title = previous;
    };
  }, [title, enabled, appName]);
}
