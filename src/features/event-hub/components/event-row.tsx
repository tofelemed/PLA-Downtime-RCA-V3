import { Checkbox } from '@/components/ui/checkbox';
import type { ProductionEventView } from '@/api/v2/types/events';
import { DurationText } from '@/features/ux-kit/duration-text';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { humanize } from '../model/event-states';
import { useEventHubEnv } from '../use-event-hub-env';
import { StateBadges } from './state-badges';

export const EVENT_GRID = 'grid grid-cols-[1.5rem_9.5rem_5.5rem_minmax(6rem,1fr)_6.5rem_minmax(6rem,1fr)_minmax(12rem,1.3fr)] items-center gap-2';

export interface EventRowProps {
  event: ProductionEventView;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  onOpen: () => void;
}

/** One list row: interval on the plant clock, server duration (C1 compact), unit, type, reason, states. */
export function EventRow({ event, selected, onToggle, onOpen }: EventRowProps) {
  const env = useEventHubEnv();
  return (
    <div className={`${EVENT_GRID} border-b px-2 py-2 text-sm hover:bg-muted/50`} data-testid="event-row" data-event-id={event.id}>
      <Checkbox checked={selected} onCheckedChange={(checked) => onToggle(checked === true)} aria-label={`Select event starting ${event.startTime}`} />
      <button type="button" className="text-left underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2" onClick={onOpen}>
        <PlantTime iso={event.startTime} tz={env.timezone} withDate />
      </button>
      <span data-testid="event-duration">
        {event.isOpen ? (
          <span className="text-blue-700 dark:text-blue-300">
            Running <DurationText seconds={event.elapsedSeconds} variant="compact" />
          </span>
        ) : (
          <DurationText seconds={event.durationSeconds} variant="compact" />
        )}
      </span>
      <span className="truncate">{env.unitName(event.unitId)}</span>
      <span className="truncate">
        {humanize(event.classification.physicalType)}
        <span className="block text-xs text-muted-foreground">{humanize(event.classification.scheduleClass)}</span>
      </span>
      <span className="truncate" data-testid="event-reason">
        {env.reasonName(event.reasonCodeId)}
      </span>
      <StateBadges states={event.states} legacyStatus={event.status} />
    </div>
  );
}

export function EventListHeader() {
  return (
    <div className={`${EVENT_GRID} border-b bg-muted/40 px-2 py-2 text-xs font-medium uppercase text-muted-foreground`} role="presentation">
      <span />
      <span>Start</span>
      <span>Duration</span>
      <span>Unit</span>
      <span>Type</span>
      <span>Reason</span>
      <span>States</span>
    </div>
  );
}
