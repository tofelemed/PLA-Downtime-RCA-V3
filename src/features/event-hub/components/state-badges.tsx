import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { EventStatesView } from '@/api/v2/types/events';
import { dimensionLabel, stateChips, type StateTone } from '../model/event-states';

const TONE_CLASS: Readonly<Record<StateTone, string>> = {
  neutral: 'border-slate-300 text-slate-700 dark:text-slate-200',
  active: 'border-blue-400 text-blue-800 dark:text-blue-200',
  warning: 'border-amber-500 text-amber-800 dark:text-amber-200',
  success: 'border-emerald-500 text-emerald-800 dark:text-emerald-200',
  muted: 'border-slate-200 text-slate-500',
};

export interface StateBadgesProps {
  states: EventStatesView;
  /** v1 status label the server derives from the three states (DT11 legacy adapter) */
  legacyStatus?: string | null;
}

/** Three state chips with text labels (colour is never the only cue, UX07) and the v1 label on hover. */
export function StateBadges({ states, legacyStatus }: StateBadgesProps) {
  const chips = (
    <span className="inline-flex flex-wrap gap-1" data-testid="state-badges">
      {stateChips(states).map((chip) => (
        <Badge
          key={chip.dimension}
          variant="outline"
          className={TONE_CLASS[chip.tone]}
          data-state-dimension={chip.dimension}
          data-state-value={chip.value}
          aria-label={`${dimensionLabel(chip.dimension)}: ${chip.label}`}
        >
          {chip.label}
        </Badge>
      ))}
    </span>
  );
  if (!legacyStatus) return chips;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chips}</TooltipTrigger>
      <TooltipContent>Legacy status: {legacyStatus}</TooltipContent>
    </Tooltip>
  );
}
