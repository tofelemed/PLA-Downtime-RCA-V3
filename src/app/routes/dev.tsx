import { lazyNamedWithPreload } from '@/lib/lazy-with-preload';
import type { AppRoute } from './route-types';

/** Builds the dev routes; called only in development so the page imports never reach a production chunk. */
function devRoutes(): AppRoute[] {
  const UxKitPlayground = lazyNamedWithPreload(() => import('@/features/ux-kit/ux-kit-playground'), 'UxKitPlayground');
  const DevErrorTest = lazyNamedWithPreload(() => import('@/features/ux-kit/dev-error-test'), 'DevErrorTest');
  return [
    { path: '/dev/ux-kit', element: <UxKitPlayground /> },
    { path: '/dev/error-test', element: <DevErrorTest /> },
  ];
}

/**
 * Development-only pages: the UX kit playground (demo data comes from the backend seeders) and the error
 * handling test page. `import.meta.env.DEV` is a build-time constant, so production builds drop `devRoutes` and its
 * imports entirely (scripts/vite-prod-bundle-guard.ts enforces it).
 */
export const DEV_ROUTES: readonly AppRoute[] = import.meta.env.DEV ? devRoutes() : [];
