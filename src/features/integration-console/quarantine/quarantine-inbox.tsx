import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIngestionExceptionsPage, usePrefetchIngestionException } from '@/api/v2/queries/ingestion-exceptions';
import { useConnections } from '@/api/v2/queries/integration-connections';
import type { IngestionExceptionView } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { EXCEPTION_STATE_LABELS, INGESTION_ERROR_LABELS, labelOf } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { ActionIcon } from '@/lib/icons';
import { useQuarantineFilters } from '../hooks/use-quarantine-filters';
import { ERROR_CODE_INFO } from '../model/exception-flow';
import { exceptionPath } from '../paths';
import { QuarantineFilters } from './quarantine-filters';
import { SourceRef } from '../components/source-ref';

export interface QuarantineInboxProps {
  timezone: string;
  /** pins the connection filter (a connection's own quarantine tab) */
  connectionId?: string;
}

interface ColumnContext {
  timezone: string;
  from: string;
  nameOf: (id: string) => string;
  prefetch: (id: string) => void;
}

function columnsOf({ timezone, from, nameOf, prefetch }: ColumnContext): DataTableColumn<IngestionExceptionView>[] {
  return [
    {
      id: 'problem',
      header: 'Problem',
      cell: (item) => (
        <Link
          to={exceptionPath(item.id)}
          state={{ from }}
          onMouseEnter={() => prefetch(item.id)}
          onFocus={() => prefetch(item.id)}
          data-testid="exception-row"
          data-exception-id={item.id}
          data-source-id={item.sourceObjectId}
          data-code={item.errorCode}
          className="font-medium underline-offset-2 hover:underline"
        >
          {ERROR_CODE_INFO[item.errorCode]?.label ?? labelOf(INGESTION_ERROR_LABELS, item.errorCode)}
        </Link>
      ),
    },
    { id: 'connection', header: 'Connection', cell: (item) => <span>{nameOf(item.connectionId)}</span> },
    { id: 'source', header: 'Source object', cell: (item) => <SourceRef value={item.sourceObjectId} /> },
    { id: 'occurrences', header: 'Occurrences', align: 'right', nowrap: true, cell: (item) => item.occurrences },
    { id: 'lastSeen', header: 'Last seen', nowrap: true, cell: (item) => <PlantTime iso={item.lastSeen} tz={timezone} withDate /> },
    { id: 'state', header: 'State', nowrap: true, cell: (item) => labelOf(EXCEPTION_STATE_LABELS, item.state) },
  ];
}

/**
 * Quarantine inbox (ING05): items newest first with problem, connection, occurrences and last seen;
 * server-side filters kept in the URL; keyset pages of 20. A row opens the item's own page, where it is
 * resolved. Unmapped PI events and rejected MQTT messages wait here.
 */
export function QuarantineInbox({ timezone, connectionId }: QuarantineInboxProps) {
  const [filters, setFilters] = useQuarantineFilters(connectionId);
  const connections = useConnections(true);
  const list = useIngestionExceptionsPage(filters);
  const prefetch = usePrefetchIngestionException();
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  const names = connections.items;
  const columns = useMemo(() => {
    const nameOf = (id: string) => names.find((connection) => connection.id === id)?.displayName ?? 'Unknown connection';
    return columnsOf({ timezone, from, nameOf, prefetch });
  }, [timezone, from, names, prefetch]);
  return (
    <section aria-label="Quarantine" className="space-y-3" data-testid="quarantine-inbox">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <QuarantineFilters filters={filters} connections={connections.items} fixedConnection={Boolean(connectionId)} onChange={setFilters} />
        </div>
        <Button size="sm" variant="outline" onClick={() => list.status.onRetry()} disabled={list.status.isRefreshing} data-testid="quarantine-refresh">
          <ActionIcon.refresh className="mr-1 h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>
      <DataTable
        caption="Quarantined items"
        columns={columns}
        rows={list.rows}
        getRowKey={(item) => item.id}
        pager={list.pager}
        status={list.status}
        empty={{ title: 'Nothing quarantined', text: 'Nothing is waiting for these filters.' }}
      />
    </section>
  );
}
