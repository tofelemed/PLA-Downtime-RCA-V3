import type { ProductionEventHistoryView } from '@/api/v2/types/events';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { humanize } from '../model/event-states';
import { useEventHubEnv } from '../use-event-hub-env';

/**
 * Evidence of the event as the API exposes it today: every source delivery (source revision id and
 * the facts it carried) and the split/merge lineage. Raw observations and attachments need a
 * `GET …/evidence` endpoint that does not exist yet (plan 3.2 decisions).
 */
export function EvidencePanel({ history }: { history: ProductionEventHistoryView }) {
  const env = useEventHubEnv();
  const deliveries = history.revisions.filter((revision) => revision.sourceFacts);
  return (
    <div className="space-y-4" data-testid="evidence-panel">
      <section aria-label="Source deliveries">
        <h4 className="mb-1 text-sm font-medium">Source deliveries</h4>
        {deliveries.length === 0 && <p className="text-xs text-muted-foreground">Entered manually — no source delivery.</p>}
        <ul className="space-y-2">
          {deliveries.map((revision) => (
            <li key={revision.id} className="rounded border p-2 text-xs">
              <div>
                r{revision.revision} · source revision {revision.sourceRevision ?? '—'} ·{' '}
                <PlantTime iso={revision.createdAt} tz={env.timezone} withDate />
              </div>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(revision.sourceFacts, null, 2)}</pre>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Lineage">
        <h4 className="mb-1 text-sm font-medium">Lineage</h4>
        {history.relations.length === 0 && <p className="text-xs text-muted-foreground">Not split or merged.</p>}
        <ul className="space-y-1">
          {history.relations.map((relation) => (
            <li key={relation.id} className="text-xs">
              {humanize(relation.relationType)}: <span className="font-mono">{relation.fromEventId.slice(0, 8)}</span> →{' '}
              <span className="font-mono">{relation.toEventId.slice(0, 8)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
