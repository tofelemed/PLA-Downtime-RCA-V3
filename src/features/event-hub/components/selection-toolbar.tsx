import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import type { EventHubState } from '../hooks/use-event-hub-state';

/** Selection actions of the event list: count, Merge, Bulk code, Code all matching and Clear selection (buttons never wrap). */
export function SelectionToolbar({ hub }: { hub: EventHubState }) {
  const { number } = useNumberFormat();
  const count = hub.selectedEvents.length;
  return (
    <div className="flex flex-wrap items-center gap-2 [&_button]:whitespace-nowrap" role="toolbar" aria-label="Selection actions">
      <span className="whitespace-nowrap text-sm text-muted-foreground" data-testid="selection-count">{number(count)} selected</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={hub.canMerge ? undefined : 0}>
            <Button size="sm" variant="outline" disabled={!hub.canMerge} onClick={() => hub.openDialog({ kind: 'merge' })}>Merge</Button>
          </span>
        </TooltipTrigger>
        {!hub.canMerge && (
          <TooltipContent>
            {hub.hasProductionLoss ? 'A production loss day cannot be merged.' : 'Select two or more events of the same unit to merge them.'}
          </TooltipContent>
        )}
      </Tooltip>
      <Button size="sm" variant="outline" disabled={count === 0} onClick={() => hub.openDialog({ kind: 'bulk' })}>Bulk code</Button>
      <Button size="sm" variant="ghost" onClick={() => hub.openDialog({ kind: 'select-all' })} data-testid="code-all-matching">
        Code all matching…
      </Button>
      {count > 0 && <Button size="sm" variant="ghost" onClick={hub.clearSelection}>Clear selection</Button>}
    </div>
  );
}
