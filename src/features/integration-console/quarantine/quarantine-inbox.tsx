import { useState } from 'react';
import { useIngestionExceptions, type ExceptionFilters } from '@/api/v2/queries/ingestion-exceptions';
import { useConnections } from '@/api/v2/queries/integration-connections';
import type { IngestionExceptionView } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { VirtualList } from '@/features/ux-kit/virtual-list';
import { ERROR_CODE_INFO } from '../model/exception-flow';
import { ExceptionDetail } from './exception-detail';
import { QuarantineFilters } from './quarantine-filters';

export interface QuarantineInboxProps {
  timezone: string;
  /** preselected connection filter */
  connectionId?: string;
}

/**
 * Quarantine inbox (ING05): open items newest first with code, connection, occurrences and first / last
 * seen; server-side filters, a virtualised list paged by keyset; the detail resolves an item. Unmapped
 * PI events live here (the v2 replacement of the v1 Plan Dashboard unmapped modal).
 */
export function QuarantineInbox({ timezone, connectionId }: QuarantineInboxProps) {
  const [filters, setFilters] = useState<ExceptionFilters>({ state: 'open', connectionId });
  const [selected, setSelected] = useState<string | null>(null);
  const connections = useConnections(true);
  const list = useIngestionExceptions(filters);
  const nameOf = (id: string) => connections.items.find((connection) => connection.id === id)?.displayName ?? id.slice(0, 8);
  const row = (item: IngestionExceptionView) => (
    <button
      type="button"
      onClick={() => setSelected(item.id)}
      aria-current={item.id === selected}
      data-testid="exception-row"
      data-exception-id={item.id}
      data-source-id={item.sourceObjectId}
      data-code={item.errorCode}
      className={`w-full border-b p-2 text-left text-sm ${item.id === selected ? 'bg-muted' : 'hover:bg-muted/50'}`}
    >
      <span className="block font-medium">{ERROR_CODE_INFO[item.errorCode]?.label ?? item.errorCode}</span>
      <span className="block text-xs text-muted-foreground">
        {nameOf(item.connectionId)} · {item.sourceObjectId} · ×{item.occurrences} · last <PlantTime iso={item.lastSeen} tz={timezone} withDate />
      </span>
    </button>
  );
  return (
    <section aria-label="Quarantine" className="space-y-3" data-testid="quarantine-inbox">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <QuarantineFilters filters={filters} connections={connections.items} onChange={setFilters} />
        </div>
        <Button size="sm" variant="outline" onClick={() => void list.refetch()} disabled={list.isFetching} data-testid="quarantine-refresh">
          Refresh
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <DataState state={dataStateOf(list, { isEmpty: list.items.length === 0 })} error={list.error} detail={list.items.length === 0 ? 'Nothing quarantined for these filters.' : undefined}>
          <VirtualList
            items={list.items}
            rowHeight={56}
            height={480}
            getKey={(item) => item.id}
            renderRow={row}
            onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
            className="rounded-md border"
          />
        </DataState>
        {selected ? <ExceptionDetail id={selected} timezone={timezone} /> : <p className="text-sm text-muted-foreground">Select an item to see what failed and resolve it.</p>}
      </div>
    </section>
  );
}
