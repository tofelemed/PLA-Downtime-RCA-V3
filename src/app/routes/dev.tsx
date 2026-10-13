import { lazyNamedWithPreload } from '@/lib/lazy-with-preload';
import type { AppRoute } from './route-types';

/** Builds the dev routes; called only in development so the page imports never reach a production chunk. */
function devRoutes(): AppRoute[] {
  const UxKitPlayground = lazyNamedWithPreload(() => import('@/features/ux-kit/ux-kit-playground'), 'UxKitPlayground');
  return [
    { path: '/dev/ux-kit', element: <UxKitPlayground /> },
  ];
}

/**
 * Development-only pages: the UX kit playground (demo data comes from the backend seeders). `import.meta.env.DEV` is a build-time constant, so production builds drop `devRoutes` and its
 * imports entirely (scripts/vite-prod-bundle-guard.ts enforces it).
 */
export const DEV_ROUTES: readonly AppRoute[] = import.meta.env.DEV ? devRoutes() : [];
