import { lazyNamedWithPreload, lazyWithPreload } from '@/lib/lazy-with-preload';
import { FlaggedRoute } from '@/features/v2-foundation/flagged-route';
import type { AppRoute } from './route-types';

const RcaV1 = lazyNamedWithPreload(() => import('@/pages/RCAModule'), 'RCAModule');
const RcaV2 = lazyNamedWithPreload(() => import('@/features/rca/rca-page'), 'RcaPage');
const KnowledgeV1 = lazyNamedWithPreload(() => import('@/pages/RCAKnowledgeBase'), 'RCAKnowledgeBase');
const KnowledgeV2 = lazyNamedWithPreload(() => import('@/features/rca-knowledge/rca-knowledge-page'), 'RcaKnowledgePage');
const Tasks = lazyWithPreload(() => import('@/pages/Tasks'));

/** Reliability area: RCA cases, the knowledge base and tasks (tracks T3, T7). */
export const RELIABILITY_ROUTES: readonly AppRoute[] = [
  {
    path: '/rca',
    element: <FlaggedRoute flag="v2.rca" v1={<RcaV1 />} v2={<RcaV2 />} preloadV2={RcaV2.preload} />,
    preload: RcaV2.preload,
  },
  {
    path: '/rca-knowledge-base',
    element: <FlaggedRoute flag="v2.rca" v1={<KnowledgeV1 />} v2={<KnowledgeV2 />} preloadV2={KnowledgeV2.preload} />,
    preload: KnowledgeV2.preload,
  },
  { path: '/tasks', element: <Tasks />, preload: Tasks.preload },
];
