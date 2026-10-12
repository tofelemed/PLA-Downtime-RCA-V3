import { lazyNamedWithPreload } from '@/lib/lazy-with-preload';
import type { AppRoute } from './route-types';

const ConsolePage = lazyNamedWithPreload(() => import('@/features/integration-console/pages/console-page'), 'ConsolePage');
const ConnectionPage = lazyNamedWithPreload(() => import('@/features/integration-console/pages/connection-page'), 'ConnectionPage');
const ConnectionEditorPage = lazyNamedWithPreload(() => import('@/features/integration-console/pages/connection-editor-page'), 'ConnectionEditorPage');
const SignalEditorPage = lazyNamedWithPreload(() => import('@/features/integration-console/pages/signal-editor-page'), 'SignalEditorPage');
const ExceptionPage = lazyNamedWithPreload(() => import('@/features/integration-console/pages/exception-page'), 'ExceptionPage');
const SourceMappingEditorPage = lazyNamedWithPreload(() => import('@/features/integration-console/pages/source-mapping-editor-page'), 'SourceMappingEditorPage');
const HistorianPage = lazyNamedWithPreload(() => import('@/features/integration-console/historian/historian-page'), 'HistorianPage');

/** Integration area: Connectivity (the integration console and its sub-pages) and the historian (track T4). */
export const INTEGRATION_ROUTES: readonly AppRoute[] = [
  { path: '/connectivity', element: <ConsolePage />, preload: ConsolePage.preload },
  { path: '/connectivity/connections/new', element: <ConnectionEditorPage />, preload: ConnectionEditorPage.preload },
  { path: '/connectivity/connections/:connectionId', element: <ConnectionPage />, preload: ConnectionPage.preload },
  { path: '/connectivity/connections/:connectionId/edit', element: <ConnectionEditorPage />, preload: ConnectionEditorPage.preload },
  { path: '/connectivity/connections/:connectionId/signals/new', element: <SignalEditorPage />, preload: SignalEditorPage.preload },
  { path: '/connectivity/quarantine/:exceptionId', element: <ExceptionPage />, preload: ExceptionPage.preload },
  { path: '/connectivity/mappings/new', element: <SourceMappingEditorPage />, preload: SourceMappingEditorPage.preload },
  { path: '/connectivity/mappings/:mappingId', element: <SourceMappingEditorPage />, preload: SourceMappingEditorPage.preload },
  { path: '/enhanced-historian', element: <HistorianPage />, preload: HistorianPage.preload },
];
