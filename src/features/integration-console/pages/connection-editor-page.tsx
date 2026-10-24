import { useNavigate, useParams } from 'react-router-dom';
import { useConnection } from '@/api/v2/queries/integration-connections';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ConnectionWizard } from '../connections/connection-wizard';
import { connectionPath, consolePath } from '../paths';

/**
 * `/connectivity/connections/new` and `/connectivity/connections/:connectionId/edit`: the connection
 * form or wizard as a page (Back leaves it; the typed password is discarded).
 */
export function ConnectionEditorPage() {
  const { connectionId } = useParams();
  const navigate = useNavigate();
  const tenantId = useV2TenantId();
  const { canWriteIntegration } = useCapabilities();
  const existing = useConnection(tenantId && connectionId ? connectionId : null);
  const cancelTo = connectionId ? connectionPath(connectionId) : consolePath();
  const saved = (connection: ConnectionView) => navigate(connectionPath(connection.id), { replace: true });
  const title = connectionId ? `Edit ${existing.data?.displayName ?? 'connection'}` : 'New connection';
  const body = () => {
    if (!tenantId) return <DataState state="no-permission" detail="Choose a plant (tenant) to manage its integrations." />;
    if (!canWriteIntegration) return <DataState state="no-permission" detail="Creating and changing connections needs an integration administrator or manager approver." />;
    if (!connectionId) return <ConnectionWizard connection={null} onClose={() => navigate(cancelTo)} onSaved={saved} />;
    return (
      <DataState state={dataStateOf(existing)} error={existing.error} onRetry={() => void existing.refetch()}>
        {existing.data && <ConnectionWizard key={existing.data.id} connection={existing.data} onClose={() => navigate(cancelTo)} onSaved={saved} />}
      </DataState>
    );
  };
  return (
    <Page>
      <PageHeader title={title} back={{ to: cancelTo, label: connectionId ? 'Connection' : 'Connections' }} />
      {body()}
    </Page>
  );
}
