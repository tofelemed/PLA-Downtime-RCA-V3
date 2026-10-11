import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFlag } from '@/api/v2/queries/feature-flags';
import { useRcaRecommendations } from '@/api/v2/queries/rca-cases';
import type { ProductionEventView } from '@/api/v2/types/events';
import type { RcaLinkResultView } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { RecommendationBadges } from './components/recommendation-badges';
import { LinkRcaDialog } from './link-dialog/link-rca-dialog';
import { SimilarKnowledgePanel } from '@/features/rca-knowledge/similar-knowledge-panel';

export interface EventRcaPanelProps {
  event: ProductionEventView;
  timezone: string;
}

/**
 * RCA part of the v2 event detail (plan 3.9, `v2.rca`): the event's open recommendations and the
 * "Create / link RCA" action (RCA writers only). Hidden while the flag is off (the v1 RCA module stays in
 * charge, C4).
 */
export function EventRcaPanel({ event, timezone }: EventRcaPanelProps) {
  const { canWriteRca } = useCapabilities();
  const flag = useFlag('v2.rca');
  const recommendations = useRcaRecommendations([event.id], flag.enabled);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<RcaLinkResultView | null>(null);
  if (!flag.enabled) return null;
  return (
    <section className="space-y-2 rounded border p-2" aria-label="Root cause analysis" data-testid="event-rca-panel">
      <RecommendationBadges items={recommendations.data ?? []} />
      <div className="flex flex-wrap items-center gap-2">
        {canWriteRca && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="open-link-rca">
            Create / link RCA
          </Button>
        )}
        {result && (
          <span className="text-sm" role="status">
            {result.created ? 'Linked to' : 'Already linked to'}{' '}
            <Link className="underline" to={`/rca?case=${result.rca.id}`}>
              {result.rca.title}
            </Link>
          </span>
        )}
      </div>
      {open && (
        <LinkRcaDialog
          eventId={event.id}
          timezone={timezone}
          context={{
            assetId: event.assetId,
            reasonCodeId: event.reasonCodeId,
            from: event.startTime,
            to: event.endTime ?? event.asOf,
          }}
          onClose={() => setOpen(false)}
          onDone={(linked) => {
            setResult(linked);
            setOpen(false);
          }}
        />
      )}
      <SimilarKnowledgePanel eventId={event.id} />
    </section>
  );
}
