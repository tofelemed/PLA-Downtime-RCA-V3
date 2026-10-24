import { useParams } from 'react-router-dom';
import { useIngestionException } from '@/api/v2/queries/ingestion-exceptions';
import { useConnection } from '@/api/v2/queries/integration-connections';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { useBackTarget } from '../hooks/use-back-target';
import { ERROR_CODE_INFO } from '../model/exception-flow';
import { consolePath } from '../paths';
import { ExceptionDetail } from '../quarantine/exception-detail';

/** `/connectivity/quarantine/:exceptionId`: one quarantined item, what failed, and how to resolve it. */
export function ExceptionPage() {
  const { exceptionId = '' } = useParams();
  const tenantId = useV2TenantId();
  const { timezone } = usePlantTimezone();
  const back = useBackTarget(consolePath('quarantine'));
  const query = useIngestionException(exceptionId);
  const connection = useConnection(query.data?.connectionId ?? null);
  const exception = query.data;
  const title = exception ? ERROR_CODE_INFO[exception.errorCode].label : 'Quarantined item';
  return (
    <Page>
      <PageHeader title={title} back={{ to: back, label: 'Quarantine' }} />
      {!tenantId ? (
        <DataState state="no-permission" detail="Choose a plant to see its quarantine." />
      ) : (
        <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
          {exception && <ExceptionDetail exception={exception} connectionName={connection.data?.displayName ?? '—'} timezone={timezone} />}
        </DataState>
      )}
    </Page>
  );
}
