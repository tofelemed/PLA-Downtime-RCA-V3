import { useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { CurrentStopsPanel } from './components/current-stops-panel';
import { EventFiltersBar } from './components/event-filters-bar';
import { EventListDialogs } from './components/event-list-dialogs';
import { EventListCard } from './components/event-list-card';
import { EventsReadOnlyHint } from './components/events-read-only-hint';
import { ExportEventsButton } from './components/export-events-button';
import { QuickStats } from './components/quick-stats';
import { RcaTriggerSettingsLink } from './components/rca-trigger-settings-link';
import { SelectionToolbar } from './components/selection-toolbar';
import { EventHubFrame } from './event-hub-frame';
import { useEventHubState, type EventHubState } from './hooks/use-event-hub-state';
import { isToCodeFilters, selectionQuery, toEventQuery, type EventSort } from './model/event-filters';

/**
 * Event Hub (plan 3.2): server filters in the URL, a paged event table (rows open `/events/:id`),
 * current stops, merge / bulk coding of selected rows, CSV export. No browser-side rules, KPIs or demo
 * data; read-only roles see no event command.
 */
export function EventHubPage() {
  return (
    <EventHubFrame>
      <EventHubScreen />
    </EventHubFrame>
  );
}

const TO_CODE_EMPTY = { title: 'Nothing to code', text: 'All stops in this window are coded.' };

function HeaderActions({ hub }: { hub: EventHubState }) {
  const { canWriteEvents } = useCapabilities();
  const location = useLocation();
  const single = hub.filters.unitIds.length === 1 ? `?unitId=${hub.filters.unitIds[0]}` : '';
  return (
    <>
      <ExportEventsButton filters={hub.filters} />
      <RcaTriggerSettingsLink />
      {canWriteEvents ? (
        <Button asChild data-testid="new-event">
          <Link to={`/events/new${single}`} state={{ listSearch: `${location.pathname}${location.search}` }}>
            <ActionIcon.add aria-hidden className="mr-1 h-4 w-4" />
            New event
          </Link>
        </Button>
      ) : (
        <EventsReadOnlyHint />
      )}
    </>
  );
}

function EventHubScreen() {
  const { canWriteEvents } = useCapabilities();
  const hub = useEventHubState();
  const { filters, changeFilters } = hub;
  const query = useMemo(() => toEventQuery(filters), [filters]);
  const sort = useMemo(() => ({ value: filters.sort, onChange: (next: EventSort) => changeFilters({ ...filters, sort: next }) }), [filters, changeFilters]);
  const selection = useMemo(
    () => (canWriteEvents ? { selectedIds: hub.selectedIds, toggle: hub.toggle, toggleMany: hub.toggleMany } : undefined),
    [canWriteEvents, hub.selectedIds, hub.toggle, hub.toggleMany],
  );
  const { openDialog } = hub;
  const openCode = useCallback((event: ProductionEventView) => openDialog({ kind: 'code', event }), [openDialog]);
  return (
    <Page width="wide">
      <div data-testid="event-hub-v2" className="space-y-6">
        <PageHeader title="Event Hub" actions={<HeaderActions hub={hub} />} />
        <EventFiltersBar filters={filters} onChange={hub.changeFilters} onReset={hub.resetFilters} />
        <QuickStats filters={filters} />
        {/* ongoing stops first, as a strip: the event table below gets the full page width */}
        <CurrentStopsPanel unitIds={filters.unitIds} onClose={(event) => hub.openDialog({ kind: 'close', event })} onCode={openCode} />
        <EventListCard
          query={query}
          selection={selection}
          onCode={canWriteEvents ? openCode : undefined}
          sort={sort}
          empty={isToCodeFilters(filters) ? TO_CODE_EMPTY : undefined}
          actions={canWriteEvents ? <SelectionToolbar hub={hub} /> : undefined}
        />
        <HubDialogs hub={hub} />
      </div>
    </Page>
  );
}

function HubDialogs({ hub }: { hub: EventHubState }) {
  return (
    <EventListDialogs
      dialog={hub.dialog}
      selectedEvents={hub.selectedEvents}
      onClose={hub.closeDialog}
      onSettled={hub.clearSelection}
      onEventChanged={hub.deselect}
      selection={selectionQuery(hub.filters)}
      onOpen={hub.openDialog}
    />
  );
}
