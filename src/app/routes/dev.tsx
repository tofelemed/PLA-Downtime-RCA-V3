import { lazyNamedWithPreload, lazyWithPreload } from '@/lib/lazy-with-preload';
import type { AppRoute } from './route-types';

/** Builds the dev routes; called only in development so the page imports never reach a production chunk. */
function devRoutes(): AppRoute[] {
  const DataSeeding = lazyWithPreload(() => import('@/pages/DataSeedingPage'));
  const UxKitPlayground = lazyNamedWithPreload(() => import('@/features/ux-kit/ux-kit-playground'), 'UxKitPlayground');
  return [
    { path: '/data-seeding', element: <DataSeeding /> },
    { path: '/dev/ux-kit', element: <UxKitPlayground /> },
  ];
}

/**
 * Development-only pages: legacy demo seeding (A4) and the UX kit playground. `import.meta.env.DEV` is a build-time constant, so production builds drop `devRoutes` and its
 * imports entirely (scripts/vite-prod-bundle-guard.ts enforces it).
 */
export const DEV_ROUTES: readonly AppRoute[] = import.meta.env.DEV ? devRoutes() : [];
