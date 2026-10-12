import { lazyNamedWithPreload } from '@/lib/lazy-with-preload';
import type { AppRoute } from './route-types';

const RcaList = lazyNamedWithPreload(() => import('@/features/rca/pages/rca-list-page'), 'RcaListPage');
const NewCase = lazyNamedWithPreload(() => import('@/features/rca/pages/new-case-page'), 'NewCasePage');
const CaseWorkspace = lazyNamedWithPreload(() => import('@/features/rca/case/case-workspace-page'), 'CaseWorkspacePage');
const Knowledge = lazyNamedWithPreload(() => import('@/features/rca-knowledge/rca-knowledge-page'), 'RcaKnowledgePage');
const KnowledgeEntry = lazyNamedWithPreload(() => import('@/features/rca-knowledge/knowledge-entry-page'), 'KnowledgeEntryPage');

/**
 * Reliability area: RCA cases (list, new case — also `?eventId=` from the Event Hub — and the case with
 * its sub-pages `/rca/:caseId/{evidence,analysis,actions,links}/…`) and the knowledge base (`/tasks` lives in
 * the administration routes).
 */
export const RELIABILITY_ROUTES: readonly AppRoute[] = [
  { path: '/rca', element: <RcaList />, preload: RcaList.preload },
  { path: '/rca/new', element: <NewCase />, preload: NewCase.preload },
  { path: '/rca/:caseId/*', element: <CaseWorkspace />, preload: CaseWorkspace.preload },
  { path: '/rca-knowledge-base', element: <Knowledge />, preload: Knowledge.preload },
  { path: '/rca-knowledge-base/:entryId', element: <KnowledgeEntry />, preload: KnowledgeEntry.preload },
];
