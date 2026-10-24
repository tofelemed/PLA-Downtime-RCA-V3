import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useConnectionsPage } from '@/api/v2/queries/integration-connections';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { FilterToggle } from '../components/filter-toggle';
import { IntegrationCard } from '../components/integration-card';
import { useUrlParam } from '../hooks/use-url-param';
import { sourceTypeLabel } from '../model/source-types';
import { connectionPath } from '../paths';

const COLUMNS: DataTableColumn<ConnectionView>[] = [
  {
    id: 'name',
    header: 'Name',
    cell: (connection) => (
      <Link to={connectionPath(connection.id)} data-testid="connection-item" data-connection-id={connection.id} className="font-medium underline-offset-2 hover:underline">
        {connection.displayName}
      </Link>
    ),
  },
  { id: 'type', header: 'Source', nowrap: true, cell: (connection) => sourceTypeLabel(connection.sourceType) },
  {
    id: 'state',
    header: 'State',
    nowrap: true,
    cell: (connection) => (
      <Badge variant={connection.isActive ? 'secondary' : 'outline'} className="whitespace-nowrap">
        {connection.isActive ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  { id: 'config', header: 'Settings version', align: 'right', nowrap: true, cell: (connection) => String(connection.configVersion) }, // an identifier: stays Latin
  { id: 'secret', header: 'Credential', nowrap: true, cell: (connection) => (connection.hasSecret ? 'Stored' : 'None') },
];

const INACTIVE = ['no', 'yes'] as const;

const CONNECTIONS_INFO = 'Connections to plant sources (PI Web API, MQTT). Credentials are stored encrypted and never shown. Create one once the PI administrator or broker owner provides the address and credentials.';

/** `GET /connections` (secrets redacted) as a table of 20 per page; a name opens the connection's page. */
export function ConnectionsList() {
  const [inactive, setInactive] = useUrlParam('inactive', INACTIVE, 'no');
  const list = useConnectionsPage(inactive === 'yes');
  const columns = useMemo(() => COLUMNS, []);
  return (
    <IntegrationCard title="Connections" info={CONNECTIONS_INFO} testId="connections-list">
      <div className="flex flex-wrap items-end gap-3">
        <FilterToggle id="include-inactive" label="Show inactive" checked={inactive === 'yes'} onChange={(on) => setInactive(on ? 'yes' : 'no')} />
      </div>
      <DataTable
        caption="Connections"
        columns={columns}
        rows={list.rows}
        getRowKey={(connection) => connection.id}
        pager={list.pager}
        status={list.status}
        empty={{ title: 'No connections yet', text: inactive === 'yes' ? 'No connections yet.' : 'No active connections.' }}
      />
    </IntegrationCard>
  );
}
