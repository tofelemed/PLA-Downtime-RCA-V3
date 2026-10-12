import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { ActionIcon } from '@/lib/icons';
import { CurrentStopsPanel } from './components/current-stops-panel';
import { EventFiltersBar } from './components/event-filters-bar';
import { EventListDialogs } from './components/event-list-dialogs';
import { EventTable } from './components/event-table';
import { ExportEventsButton } from './components/export-events-button';
import { QuickStats } from './components/quick-stats';
import { EventHubFrame } from './event-hub-frame';
import { useEventHubState, type EventHubState } from './hooks/use-event-hub-state';
import { toEventQuery } from './model/event-filters';
import { useEventHubEnv } from './use-event-hub-env';

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
      <Button variant="outline" asChild>
        <Link to="/events/rca-triggers">
          <ActionIcon.settings aria-hidden className="mr-1 h-4 w-4" />
          RCA trigger settings
        </Link>
      </Button>
      <ExportEventsButton filters={hub.filters} />
      {canWriteEvents ? (
        <Button asChild data-testid="new-event">
          <Link to={`/events/new${single}`} state={{ listSearch: `${location.pathname}${location.search}` }}>
            <ActionIcon.add aria-hidden className="mr-1 h-4 w-4" />
            New event
          </Link>
        </Button>
      ) : (
        <ReadOnlyHint />
      )}
    </>
  );
}

function EventHubScreen() {
  const { canWriteEvents } = useCapabilities();
  const env = useEventHubEnv();
  const hub = useEventHubState();
  const { filters } = hub;
  const query = useMemo(() => toEventQuery(filters), [filters]);
  const selection = useMemo(
    () => (canWriteEvents ? { selectedIds: hub.selectedIds, toggle: hub.toggle } : undefined),
    [canWriteEvents, hub.selectedIds, hub.toggle],
  );
  return (
    <Page width="wide">
      <div data-testid="event-hub-v2" className="space-y-6">
        <PageHeader
          title="Event Hub"
          description="Stops, losses and other production events of your units"
          actions={<HeaderActions hub={hub} />}
          meta={<ScopeHeader scopeLabel={scopeLabel(filters.unitIds, env.unitName)} timezone={env.timezone} timezoneIsFallback={env.timezoneIsFallback} />}
        />
        <EventFiltersBar filters={filters} onChange={hub.changeFilters} onReset={hub.resetFilters} />
        <QuickStats filters={filters} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-2">
            {canWriteEvents && <SelectionToolbar hub={hub} />}
            <EventTable caption="Production events" query={query} selection={selection} />
          </div>
          <CurrentStopsPanel unitIds={filters.unitIds} onClose={(event) => hub.openDialog({ kind: 'close', event })} />
        </div>
        <EventListDialogs dialog={hub.dialog} selectedEvents={hub.selectedEvents} onClose={hub.closeDialog} onSettled={hub.clearSelection} />
      </div>
    </Page>
  );
}

function SelectionToolbar({ hub }: { hub: EventHubState }) {
  const count = hub.selectedEvents.length;
  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Selection actions">
      <span className="text-sm text-muted-foreground" data-testid="selection-count">{count} selected</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={hub.canMerge ? undefined : 0}>
            <Button size="sm" variant="outline" disabled={!hub.canMerge} onClick={() => hub.openDialog({ kind: 'merge' })}>Merge</Button>
          </span>
        </TooltipTrigger>
        {!hub.canMerge && <TooltipContent>Select two or more events of the same unit to merge them.</TooltipContent>}
      </Tooltip>
      <Button size="sm" variant="outline" disabled={count === 0} onClick={() => hub.openDialog({ kind: 'bulk' })}>Bulk code</Button>
      {count > 0 && <Button size="sm" variant="ghost" onClick={hub.clearSelection}>Clear selection</Button>}
    </div>
  );
}
