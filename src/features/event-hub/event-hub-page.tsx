import { useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { ActionIcon } from '@/lib/icons';
import { CurrentStopsPanel } from './components/current-stops-panel';
import { EventFiltersBar } from './components/event-filters-bar';
import { EventListDialogs } from './components/event-list-dialogs';
import { EventTable } from './components/event-table';
import { EventsReadOnlyHint } from './components/events-read-only-hint';
import { ExportEventsButton } from './components/export-events-button';
import { QuickStats } from './components/quick-stats';
import { RcaTriggerSettingsLink } from './components/rca-trigger-settings-link';
import { EventHubFrame } from './event-hub-frame';
import { useEventHubState, type EventHubState } from './hooks/use-event-hub-state';
import { useWindowRangeText } from './hooks/use-window-range-text';
import { isToCodeFilters, selectionQuery, shownWindow, toEventQuery, type EventSort } from './model/event-filters';
import { useEventHubEnv } from './use-event-hub-env';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

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

function scopeLabel(unitIds: readonly string[], unitName: (id: string) => string): string {
  if (unitIds.length === 0) return 'All units in your scope';
  return unitIds.map(unitName).join(', ');
}

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
  const env = useEventHubEnv();
  const hub = useEventHubState();
  const { filters, changeFilters } = hub;
  const rangeText = useWindowRangeText();
  const windowText = rangeText(shownWindow(filters));
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
        <PageHeader
          title="Event Hub"
          description="Stops, losses and other production events of your units"
          actions={<HeaderActions hub={hub} />}
          meta={<ScopeHeader scopeLabel={`${scopeLabel(filters.unitIds, env.unitName)} · ${windowText}`} timezone={env.timezone} timezoneIsFallback={env.timezoneIsFallback} />}
        />
        <EventFiltersBar filters={filters} onChange={hub.changeFilters} onReset={hub.resetFilters} />
        <QuickStats filters={filters} windowText={windowText} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-2">
            {canWriteEvents && <SelectionToolbar hub={hub} />}
            <EventTable
              caption="Production events"
              query={query}
              selection={selection}
              onCode={canWriteEvents ? openCode : undefined}
              sort={sort}
              empty={isToCodeFilters(filters) ? TO_CODE_EMPTY : undefined}
            />
          </div>
          <CurrentStopsPanel unitIds={filters.unitIds} onClose={(event) => hub.openDialog({ kind: 'close', event })} onCode={openCode} />
        </div>
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

function SelectionToolbar({ hub }: { hub: EventHubState }) {
  const { number } = useNumberFormat();
  const count = hub.selectedEvents.length;
  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Selection actions">
      <span className="text-sm text-muted-foreground" data-testid="selection-count">{number(count)} selected</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={hub.canMerge ? undefined : 0}>
            <Button size="sm" variant="outline" disabled={!hub.canMerge} onClick={() => hub.openDialog({ kind: 'merge' })}>Merge</Button>
          </span>
        </TooltipTrigger>
        {!hub.canMerge && <TooltipContent>Select two or more events of the same unit to merge them.</TooltipContent>}
      </Tooltip>
      <Button size="sm" variant="outline" disabled={count === 0} onClick={() => hub.openDialog({ kind: 'bulk' })}>Bulk code</Button>
      <Button size="sm" variant="ghost" onClick={() => hub.openDialog({ kind: 'select-all' })} data-testid="code-all-matching">
        Code all matching…
      </Button>
      {count > 0 && <Button size="sm" variant="ghost" onClick={hub.clearSelection}>Clear selection</Button>}
    </div>
  );
}
