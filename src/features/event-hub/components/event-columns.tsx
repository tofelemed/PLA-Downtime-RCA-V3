import { Link } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
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
  };
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
      header: <span className="sr-only">Select</span>,
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
    { id: 'reason', header: 'Reason', cell: (event) => <span data-testid="event-reason">{context.reasonName(event.reasonCodeId)}</span> },
    { id: 'states', header: 'States', cell: (event) => <StateBadges states={event.states} /> },
  ];
}
