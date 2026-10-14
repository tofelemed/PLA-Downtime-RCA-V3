import { useEventSelection, type EventSelectionQuery } from '@/api/v2/queries/production-events';
import type { BulkTarget } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { usePlantFormat } from '../hooks/use-plant-format';
import { useEventHubEnv } from '../use-event-hub-env';
import { CommandError } from './command-error';

export interface SelectAllMatchingDialogProps {
  query: EventSelectionQuery | null;
  onClose: () => void;
  /** the confirmed snapshot goes to bulk coding unchanged */
  onConfirm: (targets: readonly BulkTarget[]) => void;
}

/**
 * SME D13: "all matching" is an explicit action — the server takes a versioned snapshot of every event the
 * filters match, and the user confirms its count, time span, units and assets before coding them. Events
 * changed after the snapshot are refused by bulk coding, never silently included.
 */
export function SelectAllMatchingDialog({ query, onClose, onConfirm }: SelectAllMatchingDialogProps) {
  const env = useEventHubEnv();
  const { dateTime } = usePlantFormat();
  const selection = useEventSelection(query);
  const data = selection.data;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="select-all-dialog">
        <DialogHeader>
          <DialogTitle>Code every matching event</DialogTitle>
          <DialogDescription>All events of the current filters and window, not only the rows on screen.</DialogDescription>
        </DialogHeader>
        {selection.isError ? (
          <CommandError error={selection.error} />
        ) : (
          <DataState state={dataStateOf(selection, { isEmpty: data?.count === 0 })} detail="No event matches the filters.">
            {data && (
              <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm" data-testid="selection-summary">
                <dt className="text-muted-foreground">Events</dt>
                <dd data-testid="selection-total">{data.count}</dd>
                <dt className="text-muted-foreground">From</dt>
                <dd>{dateTime(data.firstStart)}</dd>
                <dt className="text-muted-foreground">To</dt>
                <dd>{data.lastEnd ? dateTime(data.lastEnd) : 'still running'}</dd>
                <dt className="text-muted-foreground">Units</dt>
                <dd>{data.unitIds.map((id) => env.unitName(id)).join(', ')}</dd>
                <dt className="text-muted-foreground">Assets</dt>
                <dd>{data.assetCount}</dd>
              </dl>
            )}
          </DataState>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!data || data.count === 0} onClick={() => data && onConfirm(data.items)} data-testid="select-all-confirm">
            Code {data?.count ?? ''} events
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
