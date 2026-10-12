import { Link } from 'react-router-dom';
import { useRcaRecommendations } from '@/api/v2/queries/rca-cases';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { SimilarKnowledgePanel } from '@/features/rca-knowledge/similar-knowledge-panel';
import { RecommendationBadges } from './components/recommendation-badges';

export interface EventRcaPanelProps {
  event: ProductionEventView;
  /** kept for the event page's call; times are shown on the RCA pages */
  timezone?: string;
}

/**
 * RCA part of the event detail: the event's open recommendations, "Create / link RCA" (RCA writers;
 * opens `/rca/new?eventId=`), the case the event is linked to, and similar past RCAs. RCA has one
 * version (v2), so the panel no longer depends on the `v2.rca` flag (the flag still selects the server's
 * trigger behaviour).
 */
export function EventRcaPanel({ event }: EventRcaPanelProps) {
  const { canWriteRca } = useCapabilities();
  const recommendations = useRcaRecommendations([event.id]);
  return (
    <section className="space-y-2 rounded border p-2" aria-label="Root cause analysis" data-testid="event-rca-panel">
      <RecommendationBadges items={recommendations.data ?? []} />
      <div className="flex flex-wrap items-center gap-2">
        {canWriteRca && (
          <Button asChild size="sm" variant="outline" data-testid="open-link-rca">
            <Link to={`/rca/new?eventId=${encodeURIComponent(event.id)}`}>Create / link RCA</Link>
          </Button>
        )}
        {event.rcaId && (
          <Link className="text-sm underline" to={`/rca/${event.rcaId}`} data-testid="event-rca-case">
            Open the linked RCA case
          </Link>
        )}
      </div>
      <SimilarKnowledgePanel eventId={event.id} />
    </section>
  );
}
