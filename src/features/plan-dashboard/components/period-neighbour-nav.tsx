import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { UiIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { usePeriodNeighbours, type PeriodNeighbour } from '../hooks/use-period-neighbours';
import type { PeriodSpan, PlanWindow } from '../model/period-neighbours';
import { periodPath, type PeriodSection } from '../model/period-navigation';

export interface PeriodNeighbourNavProps {
  planId: string;
  period: PeriodSpan & { periodId: string };
  plan: PlanWindow;
  section: PeriodSection;
  /** `?view=…&ledger=…` kept on the neighbour */
  search: string;
}

const LINK = 'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const LABELS = { previous: 'Previous period', next: 'Next period' } as const;
const NONE = {
  previous: 'No earlier period of this unit in the plan within the 7 days before this one',
  next: 'No later period of this unit in the plan',
} as const;

type Direction = keyof typeof LABELS;

/** The text with its arrow on the side it points to. */
function Arrowed({ direction, children }: { direction: Direction; children: ReactNode }) {
  const Icon = direction === 'previous' ? UiIcon.previous : UiIcon.next;
  const icon = <Icon aria-hidden="true" className="h-3 w-3" />;
  return direction === 'previous' ? <>{icon}{children}</> : <>{children}{icon}</>;
}

function NeighbourLink({ neighbour, direction, href }: { neighbour: PeriodNeighbour | null; direction: Direction; href: string | null }) {
  const pref = useCalendarPreference();
  if (!neighbour || !href) {
    return (
      <span className={cn(LINK, 'cursor-not-allowed text-muted-foreground opacity-60')} aria-disabled="true" data-testid={`period-${direction}`} title={NONE[direction]}>
        <Arrowed direction={direction}>{LABELS[direction]}</Arrowed>
      </span>
    );
  }
  const when = `${formatOperationalDate(neighbour.localDate, pref)}${neighbour.shiftName ? ` ${neighbour.shiftName}` : ''}`;
  return (
    <Link to={href} className={cn(LINK, 'hover:bg-muted')} data-testid={`period-${direction}`} data-period-id={neighbour.periodId} aria-label={`${LABELS[direction]}: ${when}`}>
      <Arrowed direction={direction}>{when}</Arrowed>
    </Link>
  );
}

/** ◀ ▶ to the unit's previous and next production period in the plan (server list), same section and selection. */
export function PeriodNeighbourNav({ planId, period, plan, section, search }: PeriodNeighbourNavProps) {
  const { previous, next } = usePeriodNeighbours(period, plan);
  const hrefOf = (neighbour: PeriodNeighbour | null) => (neighbour ? `${periodPath(planId, neighbour.periodId, section)}${search}` : null);
  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Neighbouring periods" data-testid="period-neighbours">
      <NeighbourLink neighbour={previous} direction="previous" href={hrefOf(previous)} />
      <NeighbourLink neighbour={next} direction="next" href={hrefOf(next)} />
    </nav>
  );
}
