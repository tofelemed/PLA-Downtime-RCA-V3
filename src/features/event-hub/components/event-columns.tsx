import { Link } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { labelOf, PHYSICAL_TYPE_LABELS, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels';
import { StateBadges } from './state-badges';

export interface EventColumnContext {
  unitName: (id: string | null | undefined) => string;
  reasonName: (id: string | null | undefined) => string;
  dateTime: (iso: string | null | undefined) => string;
  /** query string of the list, so Back from the detail restores the filters */
  listSearch: string;
  prefetch: (id: string) => void;
  /** absent: no selection column (read-only users, drill lists) */
  selection?: {
    selectedIds: ReadonlySet<string>;
    toggle: (event: ProductionEventView, checked: boolean) => void;
    /** FE-07: tick every listed row (absent: no "select all" box) */
    toggleMany?: (events: readonly ProductionEventView[], checked: boolean) => void;
  };
  /** the rows listed so far ("select all listed") */
  rows?: readonly ProductionEventView[];
  /** FE-06 inline "Code" on uncoded rows (absent: no button) */
  onCode?: (event: ProductionEventView) => void;
}

/** Accessible name of a row: kind, unit and start on the plant clock (never an id). */
export function eventRowLabel(event: ProductionEventView, context: EventColumnContext): string {
  return `${labelOf(PHYSICAL_TYPE_LABELS, event.classification.physicalType)} on ${context.unitName(event.unitId)}, starting ${context.dateTime(event.startTime)}`;
}

function selectColumn(context: EventColumnContext): DataTableColumn<ProductionEventView>[] {
  const selection = context.selection;
  if (!selection) return [];
  return [
    {
      id: 'select',
      header: selectAllHeader(context),
      headerLabel: 'Select',
      width: '2.5rem',
      cell: (event) => (
        <Checkbox
          checked={selection.selectedIds.has(event.id)}
          onCheckedChange={(checked) => selection.toggle(event, checked === true)}
          aria-label={`Select ${eventRowLabel(event, context)}`}
        />
      ),
    },
  ];
}

function selectAllHeader(context: EventColumnContext) {
  const { selection, rows = [] } = context;
  if (!selection?.toggleMany || rows.length === 0) return <span className="sr-only">Select</span>;
  const all = rows.every((event) => selection.selectedIds.has(event.id));
  return (
    <Checkbox
      checked={all}
      onCheckedChange={(checked) => selection.toggleMany?.(rows, checked === true)}
      aria-label={`Select all ${rows.length} listed events`}
      data-testid="select-all-listed"
    />
  );
}

function reasonCell(event: ProductionEventView, context: EventColumnContext) {
  const uncoded = event.states.coding === 'uncoded';
  return (
    <span className="flex items-center gap-2">
      <span data-testid="event-reason">{context.reasonName(event.reasonCodeId)}</span>
      {uncoded && context.onCode && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2"
          data-testid="event-code"
          aria-label={`Code ${eventRowLabel(event, context)}`}
          onClick={(e) => {
            e.stopPropagation();
            context.onCode?.(event);
          }}
        >
          Code
        </Button>
      )}
    </span>
  );
}

function startCell(event: ProductionEventView, context: EventColumnContext) {
  return (
    <span data-testid="event-row" data-event-id={event.id}>
      <Link
        to={`/events/${event.id}`}
        state={{ listSearch: context.listSearch }}
        className="underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2"
        onMouseEnter={() => context.prefetch(event.id)}
        onFocus={() => context.prefetch(event.id)}
      >
        {context.dateTime(event.startTime)}
      </Link>
    </span>
  );
}

function durationCell(event: ProductionEventView) {
  return (
    <span data-testid="event-duration">
      {event.isOpen ? (
        <span className="text-blue-700 dark:text-blue-300">
          Running <DurationText seconds={event.elapsedSeconds} variant="compact" />
        </span>
      ) : (
        <DurationText seconds={event.durationSeconds} variant="compact" />
      )}
    </span>
  );
}

/** States, plus SME D5 "Repeat incident" when the stop is grouped with repeats (counted once in MTBF). */
function statesCell(event: ProductionEventView) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <StateBadges states={event.states} />
      {event.incidentId && (
        <Badge variant="outline" className="border-violet-400 text-violet-800 dark:text-violet-200" data-testid="event-incident" title="Repeat stops of one asset and reason, counted once in MTBF">
          Repeat incident
        </Badge>
      )}
    </span>
  );
}

/** Columns of the event list: start (link to the detail page), duration, unit, kind, reason, states. */
export function eventColumns(context: EventColumnContext): DataTableColumn<ProductionEventView>[] {
  return [
    ...selectColumn(context),
    { id: 'start', header: 'Start', nowrap: true, cell: (event) => startCell(event, context) },
    { id: 'duration', header: 'Duration', nowrap: true, align: 'right', cell: durationCell },
    { id: 'unit', header: 'Unit', cell: (event) => context.unitName(event.unitId) },
    {
      id: 'type',
      header: 'Type',
      cell: (event) => (
        <span>
          {labelOf(PHYSICAL_TYPE_LABELS, event.classification.physicalType)}
          <span className="block text-xs text-muted-foreground">{labelOf(SCHEDULE_CLASS_LABELS, event.classification.scheduleClass)}</span>
        </span>
      ),
    },
    { id: 'reason', header: 'Reason', cell: (event) => reasonCell(event, context) },
    { id: 'states', header: 'States', cell: statesCell },
  ];
}
