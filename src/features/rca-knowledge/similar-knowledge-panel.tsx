import { Link } from 'react-router-dom';
import { useSimilarKnowledge } from '@/api/v2/queries/rca-knowledge';
import { Badge } from '@/components/ui/badge';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { MATCH_LABELS } from './model/knowledge-filters';
import { QualityBadge } from './components/quality-score';

/**
 * "Similar past RCAs" of an event (owner decision 2026-10-12): knowledge entries the server ranks by the
 * event's asset, reason code and unit. Shown in the event detail (RCA is v2 for every plant).
 */
export function SimilarKnowledgePanel({ eventId }: { eventId: string }) {
  const similar = useSimilarKnowledge(eventId);
  const items = similar.data ?? [];
  return (
    <section className="space-y-1" aria-label="Similar past RCAs" data-testid="similar-knowledge">
      <h4 className="text-sm font-semibold">Similar past RCAs</h4>
      <DataState state={dataStateOf(similar, { isEmpty: items.length === 0 })} error={similar.error} onRetry={() => similar.refetch()}>
        <ul className="space-y-1 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-1">
              <Link className="underline" to={`/rca-knowledge-base/${item.id}`}>
                {item.title}
              </Link>
              {item.matchedOn.map((match) => (
                <Badge key={match} variant="secondary">{MATCH_LABELS[match] ?? match}</Badge>
              ))}
              <QualityBadge score={item.qualityScore} />
            </li>
          ))}
        </ul>
      </DataState>
    </section>
  );
}
