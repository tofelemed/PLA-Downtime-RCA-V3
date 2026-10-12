import { lazyNamedWithPreload } from '@/lib/lazy-with-preload';
import { FlaggedRoute } from '@/features/v2-foundation/flagged-route';
import type { AppRoute } from './route-types';

const ConnectivityV1 = lazyNamedWithPreload(() => import('@/pages/Connectivity'), 'Connectivity');
/** Integration console (plan 3.7), served at `/connectivity` while the `v2.integrationConsole` flag is on. */
const IntegrationConsole = lazyNamedWithPreload(
  () => import('@/features/integration-console/integration-console-page'),
  'IntegrationConsolePage',
);
const EnhancedHistorian = lazyNamedWithPreload(() => import('@/pages/EnhancedHistorian'), 'EnhancedHistorian');

/** Integration area: the integration console and the historian (track T4). */
export const INTEGRATION_ROUTES: readonly AppRoute[] = [
  {
    path: '/connectivity',
    element: (
      <FlaggedRoute
        flag="v2.integrationConsole"
        v1={<ConnectivityV1 />}
        v2={<IntegrationConsole />}
        preloadV2={IntegrationConsole.preload}
      />
    ),
    preload: IntegrationConsole.preload,
  },
  { path: '/enhanced-historian', element: <EnhancedHistorian />, preload: EnhancedHistorian.preload },
];
