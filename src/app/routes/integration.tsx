import type { ReactNode } from 'react';
import { IntegrationPageGate } from '@/features/integration-console/integration-page-gate';
import { lazyNamedWithPreload } from '@/lib/lazy-with-preload';
import type { AppRoute } from './route-types';

const ConsolePage = lazyNamedWithPreload(() => import('@/features/integration-console/pages/console-page'), 'ConsolePage');
const ConnectionPage = lazyNamedWithPreload(() => import('@/features/integration-console/pages/connection-page'), 'ConnectionPage');
const ConnectionEditorPage = lazyNamedWithPreload(() => import('@/features/integration-console/pages/connection-editor-page'), 'ConnectionEditorPage');
const SignalEditorPage = lazyNamedWithPreload(() => import('@/features/integration-console/pages/signal-editor-page'), 'SignalEditorPage');
const ExceptionPage = lazyNamedWithPreload(() => import('@/features/integration-console/pages/exception-page'), 'ExceptionPage');
const SourceMappingEditorPage = lazyNamedWithPreload(() => import('@/features/integration-console/pages/source-mapping-editor-page'), 'SourceMappingEditorPage');
const StatusMappingsPage = lazyNamedWithPreload(() => import('@/features/integration-console/status-mappings/status-mappings-page'), 'StatusMappingsPage');
const SourceAuthorityPage = lazyNamedWithPreload(() => import('@/features/integration-console/source-authority/source-authority-page'), 'SourceAuthorityPage');
const HistorianPage = lazyNamedWithPreload(() => import('@/features/integration-console/historian/historian-page'), 'HistorianPage');

interface Gate {
  title: string;
  requires: 'canReachIntegration' | 'canReviewSourcePriority' | 'canReviewSourceStatusRules';
}

const CONSOLE: Gate = { title: 'Connectivity', requires: 'canReachIntegration' };
const STATUS_RULES: Gate = { title: 'Source Status Rules', requires: 'canReviewSourceStatusRules' };
const SOURCE_PRIORITY: Gate = { title: 'Source Priority', requires: 'canReviewSourcePriority' };
const HISTORIAN: Gate = { title: 'Enhanced Historian', requires: 'canReachIntegration' };

/** A route of the section with its page gate; `requires` is also the route gate. */
function gated(path: string, page: ReactNode, preload: () => Promise<unknown>, gate: Gate = CONSOLE): AppRoute {
  return {
    path,
    element: <IntegrationPageGate title={gate.title} requires={gate.requires}>{page}</IntegrationPageGate>,
    preload,
    requires: gate.requires,
    gateTitle: gate.title,
  };
}

/**
 * Integration area: Connectivity (the integration console and its sub-pages) and the historian (track T4).
 * Owner 18 Oct 2026: SuperAdmin only. The Source Priority and Source Status Rules pages also open for
 * their maker-checker approvers, who reach them from the approvals inbox (the menu stays hidden).
 */
export const INTEGRATION_ROUTES: readonly AppRoute[] = [
  gated('/connectivity', <ConsolePage />, ConsolePage.preload),
  gated('/connectivity/connections/new', <ConnectionEditorPage />, ConnectionEditorPage.preload),
  gated('/connectivity/connections/:connectionId', <ConnectionPage />, ConnectionPage.preload),
  gated('/connectivity/connections/:connectionId/edit', <ConnectionEditorPage />, ConnectionEditorPage.preload),
  gated('/connectivity/connections/:connectionId/signals/new', <SignalEditorPage />, SignalEditorPage.preload),
  gated('/connectivity/quarantine/:exceptionId', <ExceptionPage />, ExceptionPage.preload),
  gated('/connectivity/mappings/new', <SourceMappingEditorPage />, SourceMappingEditorPage.preload),
  gated('/connectivity/mappings/:mappingId', <SourceMappingEditorPage />, SourceMappingEditorPage.preload),
  gated('/connectivity/source-status', <StatusMappingsPage />, StatusMappingsPage.preload, STATUS_RULES),
  gated('/connectivity/source-authority', <SourceAuthorityPage />, SourceAuthorityPage.preload, SOURCE_PRIORITY),
  gated('/enhanced-historian', <HistorianPage />, HistorianPage.preload, HISTORIAN),
];
