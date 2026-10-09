import { useProductionEvents } from '@/api/v2/queries/production-events';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { CurrentStopsPanel } from './components/current-stops-panel';
import { EventDetailDrawer } from './components/event-detail-drawer';
import { EventFiltersBar } from './components/event-filters-bar';
import { EventHubDialogs } from './components/event-hub-dialogs';
import { EventList } from './components/event-list';
import { QuickStats } from './components/quick-stats';
import { EventHubEnvProvider } from './event-hub-env';
import { useEventHubEnv } from './use-event-hub-env';
import { useEventHubState } from './hooks/use-event-hub-state';
import { toEventQuery } from './model/event-filters';

/**
 * Event Hub on v2 (plan 3.2), behind the `v2.eventHub` flag: server filters and keyset pages, current
 * stops, explicit durations, source vs effective, split / merge / bulk code / close, realtime refresh
 * (the scoped channel invalidates these queries). No browser-side rules, KPIs or demo data.
 */
export function EventHubPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant (tenant) to see its events." />;
  return (
    <EventHubEnvProvider tenantId={tenantId}>
      <EventHubScreen />
    </EventHubEnvProvider>
  );
}

function scopeLabel(unitIds: readonly string[], unitName: (id: string) => string): string {
  if (unitIds.length === 0) return 'All units in your scope';
  return unitIds.map(unitName).join(', ');
}

function EventHubScreen() {
  const env = useEventHubEnv();
  const hub = useEventHubState();
  const { filters } = hub;
  const list = useProductionEvents(toEventQuery(filters), env.timezone);
  const events = flattenPages(list.data?.pages);
  const asOf = list.data?.pages[0]?.asOf ?? null;
  const settle = (openEventId: string | null) => {
    hub.closeDialog();
    hub.clearSelection();
    hub.openDetail(openEventId);
  };
  return (
    <div className="space-y-4" data-testid="event-hub-v2">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Event Hub</h1>
          <ScopeHeader scopeLabel={scopeLabel(filters.unitIds, env.unitName)} timezone={env.timezone} timezoneIsFallback={env.timezoneIsFallback} asOf={asOf} />
        </div>
        <Button onClick={() => hub.openDialog({ kind: 'form', eventId: null })}>New event</Button>
      </header>
      <EventFiltersBar filters={filters} onChange={hub.changeFilters} onReset={hub.resetFilters} />
      <QuickStats filters={filters} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-2">
          <SelectionToolbar hub={hub} />
          <EventList events={events} query={list} selectedIds={hub.selectedIds} onToggle={hub.toggle} onOpen={(event) => hub.openDetail(event.id)} />
        </div>
        <CurrentStopsPanel filters={filters} onOpen={(event) => hub.openDetail(event.id)} onClose={(event) => hub.openDialog({ kind: 'close', event })} />
      </div>
      <EventDetailDrawer
        eventId={hub.detailId}
        onOpenChange={(open) => !open && hub.openDetail(null)}
        onAction={(action, event) => hub.openDialog(action === 'edit' ? { kind: 'form', eventId: event.id } : { kind: action, event })}
      />
      <EventHubDialogs
        dialog={hub.dialog}
        selectedEvents={hub.selectedEvents}
        defaultUnitId={filters.unitIds.length === 1 ? filters.unitIds[0] : ''}
        onClose={hub.closeDialog}
        onSettled={settle}
      />
    </div>
  );
}

function SelectionToolbar({ hub }: { hub: ReturnType<typeof useEventHubState> }) {
  const count = hub.selectedEvents.length;
  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Selection actions">
      <span className="text-sm text-muted-foreground" data-testid="selection-count">{count} selected</span>
      <Button size="sm" variant="outline" disabled={!hub.canMerge} onClick={() => hub.openDialog({ kind: 'merge' })}>Merge</Button>
      <Button size="sm" variant="outline" disabled={count === 0} onClick={() => hub.openDialog({ kind: 'bulk' })}>Bulk code</Button>
      {count > 0 && <Button size="sm" variant="ghost" onClick={hub.clearSelection}>Clear selection</Button>}
    </div>
  );
}
