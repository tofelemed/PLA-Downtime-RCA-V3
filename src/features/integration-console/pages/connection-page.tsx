import { useParams } from 'react-router-dom';
import { useConnection } from '@/api/v2/queries/integration-connections';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { ConnectionDetail } from '../connections/connection-detail';
import { ConnectionHeader } from '../connections/connection-header';
import { consolePath } from '../paths';

/** `/connectivity/connections/:connectionId`: one connection with its tabs (`?tab=`). */
export function ConnectionPage() {
  const { connectionId = '' } = useParams();
  const tenantId = useV2TenantId();
  const { timezone } = usePlantTimezone();
  const query = useConnection(tenantId ? connectionId : null);
  const connection = query.data;
  return (
    <Page width="wide">
      {connection ? (
        <ConnectionHeader connection={connection} />
      ) : (
        <PageHeader title="Connection" back={{ to: consolePath(), label: 'Connections' }} />
      )}
      {!tenantId ? (
        <DataState state="no-permission" detail="Choose a plant (tenant) to manage its integrations." />
      ) : (
        <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
          {connection && <ConnectionDetail key={connection.id} connection={connection} timezone={timezone} />}
        </DataState>
      )}
    </Page>
  );
}
