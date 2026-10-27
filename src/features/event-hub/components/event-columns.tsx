import { Link } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { labelOf, PHYSICAL_TYPE_LABELS, SCHEDULE_CLASS_LABELS, SOURCE_KIND_LABELS } from '@/features/ux-kit/labels';
import { DurationSortHeader, StartSortHeader, type EventSortControl } from './event-sort-headers';
import { isProductionLoss } from '../model/production-loss';
import { sameName } from '../model/name-repeats';
import { declaredColumns } from './declared-columns';
import { EventStateCell } from './event-state-cell';
import { StatesHeader } from './states-header';
import { UnitLabel } from './unit-label';

export interface EventColumnContext {
  unitName: (id: string | null | undefined) => string;
  reasonName: (id: string | null | undefined) => string;
  /** E-1: asset names (absent: "—") */
  assetName?: (id: string | null | undefined) => string;
  dateTime: (iso: string | null | undefined) => string;
  /** plant-local date; a production loss event (one day) shows it instead of a duration */
  date?: (iso: string | null | undefined) => string;
  /** declared mode (the unit's policy, or a production loss event is listed): Planned / Actual / Lost columns */
  declared?: boolean;
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
  /** E-1: one list order, toggled from the Start and Duration headers (absent: fixed order, no toggle) */
  sort?: EventSortControl;
}

/** E-1 Origin column: short words; the full label is the tooltip. */
const ORIGIN_SHORT: Readonly<Record<string, string>> = { manual: 'Manual', source: 'Source', derived: 'Derived', imported: 'Imported' };

/** Kind, unit and start on the plant clock (never an id): names the row's checkbox and link. */
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
        <span className="sr-only">{`Open ${labelOf(PHYSICAL_TYPE_LABELS, event.classification.physicalType)} on ${context.unitName(event.unitId)}, starting `}</span>
        {context.dateTime(event.startTime)}
      </Link>
    </span>
  );
}

function durationCell(event: ProductionEventView, context: EventColumnContext) {
  if (isProductionLoss(event) && context.date) return <span data-testid="event-duration">{context.date(event.startTime)}</span>;
  return (
    <span data-testid="event-duration">
      {event.isOpen ? (
        <span className="text-info">
          Ongoing <DurationText seconds={event.elapsedSeconds} />
        </span>
      ) : (
        <DurationText seconds={event.durationSeconds} />
      )}
    </span>
  );
}

function typeCell(event: ProductionEventView) {
  return (
    <span className="block whitespace-nowrap">
      {labelOf(PHYSICAL_TYPE_LABELS, event.classification.physicalType)}
      {/* the schedule class under the kind keeps the column narrow (the table fits without scrolling) */}
      <span className="block text-xs text-muted-foreground">{labelOf(SCHEDULE_CLASS_LABELS, event.classification.scheduleClass)}</span>
    </span>
  );
}

function originCell(event: ProductionEventView) {
  return (
    <span title={labelOf(SOURCE_KIND_LABELS, event.sourceKind)} data-testid="event-origin">
      {(event.sourceKind !== 'manual' && event.source?.trim()) || ORIGIN_SHORT[event.sourceKind] || labelOf(SOURCE_KIND_LABELS, event.sourceKind)}
    </span>
  );
}

/** Unit name with the asset under it when the event names one that is not the unit's own name (most stops carry no asset). */
function unitCell(event: ProductionEventView, context: EventColumnContext) {
  const asset = event.assetId && context.assetName ? context.assetName(event.assetId) : null;
  return (
    <div>
      <UnitLabel unitId={event.unitId} />
      {asset && !sameName(context.unitName(event.unitId), asset) && (
        <div className="text-xs text-muted-foreground" data-testid="event-asset">
          {asset}
        </div>
      )}
    </div>
  );
}

/** Columns of the event list: start (link, sortable), duration (sortable), unit with asset, kind, reason, states, data source. */
export function eventColumns(context: EventColumnContext): DataTableColumn<ProductionEventView>[] {
  return [
    ...selectColumn(context),
    { id: 'start', header: <StartSortHeader sort={context.sort} />, headerLabel: 'Start', nowrap: true, cell: (event) => startCell(event, context) },
    { id: 'duration', header: <DurationSortHeader sort={context.sort} />, headerLabel: 'Duration', nowrap: true, align: 'right', cell: (event) => durationCell(event, context) },
    ...(context.declared ? declaredColumns() : []),
    { id: 'unit', header: 'Unit · asset', nowrap: true, cell: (event) => unitCell(event, context) },
    { id: 'type', header: 'Type', cell: typeCell },
    { id: 'reason', header: 'Reason', cell: (event) => reasonCell(event, context) },
    { id: 'states', header: <StatesHeader />, headerLabel: 'States', cell: (event) => <EventStateCell event={event} /> },
    { id: 'origin', header: 'Source', nowrap: true, cell: originCell },
  ];
}
