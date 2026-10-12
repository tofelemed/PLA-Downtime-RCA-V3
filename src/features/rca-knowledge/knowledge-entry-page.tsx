import { Navigate, useParams } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { DataState } from '@/features/ux-kit/data-state';
import { Page } from '@/features/ux-kit/page-layout';
import { KnowledgeDetail } from './components/knowledge-detail';

/** `/rca-knowledge-base/:entryId`: one knowledge entry (deep-linkable from cases and similar RCAs). */
export function KnowledgeEntryPage() {
  const tenantId = useV2TenantId();
  const { entryId } = useParams();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its RCA knowledge base." />;
  if (!entryId) return <Navigate to="/rca-knowledge-base" replace />;
  return (
    <Page>
      <KnowledgeDetail key={entryId} id={entryId} />
    </Page>
  );
}
