import { lazy, Suspense, useMemo, type ComponentType } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useRcaCase } from '@/api/v2/queries/rca-cases';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page } from '@/features/ux-kit/page-layout';
import { CaseWorkspaceContext, useCaseWorkspace, type CaseWorkspaceValue } from './case-context';
import { normalizeCase } from '../model/normalize-case';
import { CaseHeader } from './case-header';
import { CaseNav } from './case-nav';
import { OverviewPage } from './overview/overview-page';

const named = <T,>(load: () => Promise<T>, name: keyof T) =>
  lazy(async () => ({ default: (await load())[name] as unknown as ComponentType }));

const EvidenceListPage = named(() => import('./evidence/evidence-list-page'), 'EvidenceListPage');
const EvidenceDetailPage = named(() => import('./evidence/evidence-detail-page'), 'EvidenceDetailPage');
const EvidenceFormPage = named(() => import('./evidence/evidence-form-page'), 'EvidenceFormPage');
const AnalysisIndexPage = named(() => import('./analysis/analysis-index-page'), 'AnalysisIndexPage');
const AnalysisToolPage = named(() => import('./analysis/analysis-tool-page'), 'AnalysisToolPage');
const ActionsPage = named(() => import('./actions/actions-page'), 'ActionsPage');
const RecommendationFormPage = named(() => import('./actions/recommendation-form-page'), 'RecommendationFormPage');
const LinksPage = named(() => import('./links/links-page'), 'LinksPage');

function CaseRoutes() {
  const { basePath } = useCaseWorkspace();
  return (
    <Suspense fallback={<DataState state="loading" />}>
      <Routes>
        <Route index element={<OverviewPage />} />
        <Route path="evidence" element={<EvidenceListPage />} />
        <Route path="evidence/new" element={<EvidenceFormPage />} />
        <Route path="evidence/:evidenceId" element={<EvidenceDetailPage />} />
        <Route path="evidence/:evidenceId/edit" element={<EvidenceFormPage />} />
        <Route path="analysis" element={<AnalysisIndexPage />} />
        <Route path="analysis/:tool" element={<AnalysisToolPage />} />
        <Route path="actions" element={<ActionsPage />} />
        <Route path="actions/recommendations/new" element={<RecommendationFormPage />} />
        <Route path="actions/recommendations/:recommendationId/edit" element={<RecommendationFormPage />} />
        <Route path="links" element={<LinksPage />} />
        <Route path="*" element={<Navigate to={basePath} replace />} />
      </Routes>
    </Suspense>
  );
}

function Workspace({ caseId }: { caseId: string }) {
  const detail = useRcaCase(caseId);
  const { canWriteRca } = useCapabilities();
  const rca = detail.data;
  const value = useMemo<CaseWorkspaceValue | null>(
    () => (rca ? { rca: normalizeCase(rca), readOnly: !canWriteRca, basePath: `/rca/${rca.id}` } : null),
    [rca, canWriteRca],
  );
  return (
    <DataState state={dataStateOf(detail)} error={detail.error} onRetry={() => detail.refetch()}>
      {value && (
        <CaseWorkspaceContext.Provider value={value}>
          <Page width="wide">
            <div className="space-y-3" data-testid="case-detail">
              <CaseHeader />
              <CaseNav />
            </div>
            <CaseRoutes />
          </Page>
        </CaseWorkspaceContext.Provider>
      )}
    </DataState>
  );
}

/** `/rca/:caseId/*`: one case with its sub-pages (overview, evidence, analysis, actions, links). */
export function CaseWorkspacePage() {
  const tenantId = useV2TenantId();
  const { caseId } = useParams();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its RCA cases." />;
  if (!caseId) return <Navigate to="/rca" replace />;
  return <Workspace key={caseId} caseId={caseId} />;
}
