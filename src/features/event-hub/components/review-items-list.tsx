import { useResolveReviewItem, type EventRef } from '@/api/v2/queries/event-commands';
import type { EventReviewItemView } from '@/api/v2/types/events';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { humanize, labelOf, REVIEW_ITEM_STATE_LABELS } from '@/features/ux-kit/labels';
import { factLabel } from '../model/fact-display';
import { usePlantFormat } from '../hooks/use-plant-format';
import { CommandError } from './command-error';

export interface ReviewItemsListProps {
  event: EventRef;
  items: readonly EventReviewItemView[];
}

/** §5.3 decisions owed on the event: keep the user's override or accept the source value. */
export function ReviewItemsList({ event, items }: ReviewItemsListProps) {
  const { canWriteEvents } = useCapabilities();
  const { dateTime } = usePlantFormat();
  const resolve = useResolveReviewItem();
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No review items.</p>;
  return (
    <div className="space-y-2" data-testid="review-items">
      <CommandError error={resolve.error} />
      {items.map((item) => (
        <div key={item.id} className="rounded border p-2 text-sm">
          <div className="flex items-center justify-between">
            <span>
              {humanize(item.kind)}
              {item.field && <span className="ml-1 text-xs text-muted-foreground">({factLabel(item.field)})</span>}
            </span>
            <Badge variant={item.state === 'open' ? 'secondary' : 'outline'}>{labelOf(REVIEW_ITEM_STATE_LABELS, item.state)}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Raised {dateTime(item.createdAt)}
          </div>
          {item.state === 'open' && canWriteEvents && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => void resolve.submit({ item, event, decision: 'keep_override' }).catch(() => undefined)}>
                Keep my value
              </Button>
              <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => void resolve.submit({ item, event, decision: 'accept_source' }).catch(() => undefined)}>
                Accept source
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
