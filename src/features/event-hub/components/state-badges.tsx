import type { EventStatesView } from '@/api/v2/types/events';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { cn } from '@/lib/utils';
import { dimensionLabel, stateChips, type StateChip } from '../model/event-states';

interface StateBadgesProps {
  states: EventStatesView;
  className?: string;
  /** dimensions shown by another chip (the event list shows the RCA state as the shared RCA chip) */
  omit?: ReadonlyArray<StateChip['dimension']>;
}

/** Three state chips with text labels in one row (colour is never the only cue, UX07). */
export function StateBadges({ states, className, omit = [] }: StateBadgesProps) {
  return (
    <span className={cn('inline-flex flex-wrap gap-1', className)} data-testid="state-badges">
      {stateChips(states).filter((chip) => !omit.includes(chip.dimension)).map((chip) => (
        <StatusBadge
          key={chip.dimension}
          tone={chip.tone}
          className="whitespace-nowrap"
          data-state-dimension={chip.dimension}
          data-state-value={chip.value}
          aria-label={`${dimensionLabel(chip.dimension)}: ${chip.label}`}
        >
          {chip.label}
        </StatusBadge>
      ))}
    </span>
  );
}
