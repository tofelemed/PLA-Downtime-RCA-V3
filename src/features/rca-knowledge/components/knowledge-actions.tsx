import { usePublishKnowledge, useShareKnowledge, useVoteKnowledge } from '@/api/v2/queries/rca-knowledge';
import type { RcaKnowledgeView } from '@/api/v2/types/rca-knowledge';
import { Button } from '@/components/ui/button';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { ActionIcon } from '@/lib/icons';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

/** Helpful / not helpful: one vote per user (the server replaces an earlier vote). */
export function VoteButtons({ entry }: { entry: RcaKnowledgeView }) {
  const { number } = useNumberFormat();
  const vote = useVoteKnowledge();
  const cast = (helpful: boolean) => void vote.submit({ id: entry.id, helpful }).catch(() => undefined);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Vote">
        <Button
          size="sm"
          variant={entry.myVote === 'helpful' ? 'default' : 'outline'}
          aria-pressed={entry.myVote === 'helpful'}
          disabled={vote.isPending}
          onClick={() => cast(true)}
        >
          <ActionIcon.voteUp className="mr-1 h-4 w-4" aria-hidden /> Helpful ({number(entry.helpfulCount)})
        </Button>
        <Button
          size="sm"
          variant={entry.myVote === 'not_helpful' ? 'default' : 'outline'}
          aria-pressed={entry.myVote === 'not_helpful'}
          disabled={vote.isPending}
          onClick={() => cast(false)}
        >
          <ActionIcon.voteDown className="mr-1 h-4 w-4" aria-hidden /> Not helpful ({number(entry.notHelpfulCount)})
        </Button>
      </div>
      {vote.error ? <FriendlyErrorAlert error={vote.error} /> : null}
    </div>
  );
}

/**
 * CA9: share a published lesson with the other plants of the organization (read-only there, with its
 * status), or stop sharing it. 409 NOT_PUBLISHED for an unpublished entry.
 */
export function ShareControl({ entry }: { entry: RcaKnowledgeView }) {
  const share = useShareKnowledge();
  const shared = entry.shareScope === 'organization';
  const toggle = () => void share.submit({ entry, share: !shared }).catch(() => undefined);
  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" disabled={share.isPending || (!shared && !entry.isPublished)} onClick={toggle} data-testid="knowledge-share">
        {shared ? 'Stop sharing with other plants' : 'Share with other plants'}
      </Button>
      {!shared && !entry.isPublished && <p className="text-xs text-muted-foreground">Publish it first.</p>}
      {share.error ? <FriendlyErrorAlert error={share.error} /> : null}
    </div>
  );
}

/** Publish / withdraw with the row version the user saw (412 when someone changed it meanwhile). */
export function PublishControl({ entry }: { entry: RcaKnowledgeView }) {
  const publish = usePublishKnowledge();
  const toggle = () => void publish.submit({ entry, publish: !entry.isPublished }).catch(() => undefined);
  return (
    <div className="space-y-1">
      <Button size="sm" variant={entry.isPublished ? 'outline' : 'default'} disabled={publish.isPending} onClick={toggle} data-testid="knowledge-publish">
        {entry.isPublished ? 'Unpublish' : 'Publish'}
      </Button>
      {publish.error ? <FriendlyErrorAlert error={publish.error} /> : null}
    </div>
  );
}
