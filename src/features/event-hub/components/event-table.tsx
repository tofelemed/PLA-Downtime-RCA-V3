import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ProductionEventFilters } from '@/api/v2/queries/production-events';
import type { QueryParams } from '@/api/v2/request-url';
import { usePagedQuery } from '@/api/v2/queries/use-paged-query';
import type { ProductionEventView } from '@/api/v2/types/events';
import { DataTable, type DataTableEmpty } from '@/features/ux-kit/data-table';
import { useAssetNames } from '@/features/ux-kit/labels';
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

/** Production events as a server-paged table: 20 per page, keyset pages, rows open `/events/:id`. */
export function EventTable({ caption, query, selection, onCode, sort, empty, testId = 'event-list' }: EventTableProps) {
  const env = useEventHubEnv();
  const assets = useAssetNames();
  const navigate = useNavigate();
  const location = useLocation();
  const { dateTime } = usePlantFormat();
  const { prefetch, seed } = usePrefetchEvent();
  const { from, to, unitIds, limit: _limit, ...rest } = query;
  const paged = usePagedQuery<ProductionEventView>({
    resource: 'production-events',
    path: '/production-events',
    query: query as QueryParams,
    key: { scope: { unitIds }, window: { from, to, tz: env.timezone }, filters: rest },
  });
  const listSearch = `${location.pathname}${location.search}`;
  const context = useMemo<EventColumnContext>(
    () => ({ unitName: env.unitName, reasonName: env.reasonName, assetName: assets.nameOf, dateTime, listSearch, prefetch, selection, rows: paged.rows, onCode, sort }),
    [env.unitName, env.reasonName, assets.nameOf, dateTime, listSearch, prefetch, selection, paged.rows, onCode, sort],
  );
  const columns = useMemo(() => eventColumns(context), [context]);
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
        empty={empty ?? { title: 'No events', text: 'No event matches the filters in this window.' }}
        onRowClick={open}
        rowsHaveLink
      />
    </div>
  );
}
