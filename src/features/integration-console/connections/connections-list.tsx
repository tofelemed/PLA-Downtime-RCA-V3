import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useConnectionsPage } from '@/api/v2/queries/integration-connections';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
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
  { id: 'state', header: 'State', nowrap: true, cell: (connection) => (connection.isActive ? 'Active' : 'Inactive') },
  { id: 'config', header: 'Settings version', align: 'right', nowrap: true, cell: (connection) => String(connection.configVersion) }, // an identifier: stays Latin
  { id: 'secret', header: 'Credential', nowrap: true, cell: (connection) => (connection.hasSecret ? 'Stored' : 'None') },
];

const INACTIVE = ['no', 'yes'] as const;

/** `GET /connections` (secrets redacted) as a table of 20 per page; a name opens the connection's page. */
export function ConnectionsList() {
  const [inactive, setInactive] = useUrlParam('inactive', INACTIVE, 'no');
  const list = useConnectionsPage(inactive === 'yes');
  const columns = useMemo(() => COLUMNS, []);
  return (
    <div className="space-y-3" data-testid="connections-list">
      <div className="flex items-center gap-2">
        <Checkbox id="include-inactive" checked={inactive === 'yes'} onCheckedChange={(checked) => setInactive(checked === true ? 'yes' : 'no')} />
        <Label htmlFor="include-inactive" className="text-sm">
          Show inactive
        </Label>
      </div>
      <DataTable
        caption="Connections"
        columns={columns}
        rows={list.rows}
        getRowKey={(connection) => connection.id}
        pager={list.pager}
        status={list.status}
        empty={{ title: 'No connections yet', text: 'Create a connection once the PI administrator or broker owner provides the address and credentials.' }}
      />
    </div>
  );
}
