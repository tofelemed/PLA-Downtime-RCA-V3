import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ProductionEventFilters } from '@/api/v2/queries/production-events';
import type { QueryParams } from '@/api/v2/request-url';
import { usePagedQuery } from '@/api/v2/queries/use-paged-query';
import type { ProductionEventView } from '@/api/v2/types/events';
import { DataTable, type DataTableEmpty } from '@/features/ux-kit/data-table';
import { EmptyMessage } from '@/features/ux-kit/data-table/data-table-states';
import { useAssetNames } from '@/features/ux-kit/labels';
import { useReportLook } from '@/features/ux-kit/report-look';
import { isProductionLoss } from '../model/production-loss';
import { useDeclaredScope } from '../hooks/use-declared-scope';
import { usePlantFormat } from '../hooks/use-plant-format';
import { usePrefetchEvent } from '../hooks/use-prefetch-event';
import { useEventHubEnv } from '../use-event-hub-env';
import { eventColumns, type EventColumnContext } from './event-columns';

export interface EventTableProps {
  caption: string;
  /** server filters of the list (the pager sets `limit`) */
  query: ProductionEventFilters;
  selection?: EventColumnContext['selection'];
  onCode?: EventColumnContext['onCode'];
  /** E-1: start-time order toggle (absent: no toggle) */
  sort?: EventColumnContext['sort'];
  empty?: DataTableEmpty;
  testId?: string;
}

const NO_EVENTS: DataTableEmpty = { title: 'No events', text: 'No event matches the filters in this window.' };

function useEventPages(query: ProductionEventFilters, timezone: string) {
  const { from, to, unitIds, limit: _limit, ...rest } = query;
  return usePagedQuery<ProductionEventView>({
    resource: 'production-events',
    path: '/production-events',
    query: query as QueryParams,
    key: { scope: { unitIds }, window: { from, to, tz: timezone }, filters: rest },
  });
}

function ListEmpty({ empty, testId }: { empty: DataTableEmpty; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-md border px-4 py-10">
      <EmptyMessage empty={empty} />
    </div>
  );
}

/** Production events as a server-paged table: 20 per page, keyset pages, rows open `/events/:id`. */
export function EventTable({ caption, query, selection, onCode, sort, empty, testId = 'event-list' }: EventTableProps) {
  const env = useEventHubEnv();
  const look = useReportLook();
  const assets = useAssetNames();
  const navigate = useNavigate();
  const location = useLocation();
  const { dateTime, date } = usePlantFormat();
  const declaredScope = useDeclaredScope(query.unitIds ?? []);
  const { prefetch, seed } = usePrefetchEvent();
  const paged = useEventPages(query, env.timezone);
  const declared = declaredScope || paged.rows.some(isProductionLoss);
  const listSearch = `${location.pathname}${location.search}`;
  const context = useMemo<EventColumnContext>(
    () => ({ unitName: env.unitName, reasonName: env.reasonName, assetName: assets.nameOf, dateTime, date, declared, listSearch, prefetch, selection, rows: paged.rows, onCode, sort }),
    [env.unitName, env.reasonName, assets.nameOf, dateTime, date, declared, listSearch, prefetch, selection, paged.rows, onCode, sort],
  );
  const columns = useMemo(() => eventColumns(context), [context]);
  const shownEmpty = empty ?? NO_EVENTS;
  // the report look would say "No data for these dates": the list keeps its own message
  if (look && paged.rows.length === 0 && !paged.status.isLoading && !paged.status.isError) return <ListEmpty empty={shownEmpty} testId={testId} />;
  const open = (event: ProductionEventView) => {
    seed(event);
    navigate(`/events/${event.id}`, { state: { listSearch } });
  };
  return (
    <div data-testid={testId}>
      <DataTable
        caption={caption}
        columns={columns}
        rows={paged.rows}
        getRowKey={(event) => event.id}
        pager={paged.pager}
        status={paged.status}
        empty={shownEmpty}
        onRowClick={open}
        rowsHaveLink
      />
    </div>
  );
}
