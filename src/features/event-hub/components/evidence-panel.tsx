import { Link } from 'react-router-dom';
import type { EventRelationView, EventRevisionView, ProductionEventHistoryView } from '@/api/v2/types/events';
import { humanize } from '@/features/ux-kit/labels';
import { factLabel, factText, type FactResolvers } from '../model/fact-display';
import { useFactResolvers } from '../hooks/use-fact-resolvers';

const RELATION_LABELS: Readonly<Record<string, { self: string; other: string }>> = {
  split_child_of: { self: 'Split part of', other: 'Was split into' },
  merged_from: { self: 'Merged from', other: 'Merged into' },
};

/** "Split part of" from the child's side, "Was split into" from the parent's side. */
function relationText(relation: EventRelationView, eventId: string): { text: string; otherId: string } {
  const labels = RELATION_LABELS[relation.relationType];
  const isFrom = relation.fromEventId === eventId;
  const otherId = isFrom ? relation.toEventId : relation.fromEventId;
  if (!labels) return { text: humanize(relation.relationType), otherId };
  return { text: isFrom ? labels.self : labels.other, otherId };
}

function Delivery({ revision, resolvers }: { revision: EventRevisionView; resolvers: FactResolvers }) {
  const facts = Object.entries(revision.sourceFacts ?? {});
  return (
    <li className="space-y-1 rounded border p-2 text-xs">
      <div className="font-medium">
        Revision {revision.revision} · received {resolvers.dateTime(revision.createdAt)}
      </div>
      <dl className="grid grid-cols-[10rem_1fr] gap-x-2 gap-y-0.5">
        {facts.map(([field, value]) => (
          <div key={field} className="contents">
            <dt className="text-muted-foreground">{factLabel(field)}</dt>
            <dd>{factText(field, value, resolvers)}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary className="cursor-pointer text-muted-foreground">Show raw payload (for support)</summary>
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(revision.sourceFacts, null, 2)}</pre>
      </details>
    </li>
  );
}

/**
 * Evidence of the event as the API exposes it today: every source delivery (labelled facts, the raw
 * payload behind a disclosure) and the split / merge lineage with links to the related events.
 */
export function EvidencePanel({ history, eventId }: { history: ProductionEventHistoryView; eventId: string }) {
  const resolvers = useFactResolvers();
  const deliveries = history.revisions.filter((revision) => revision.sourceFacts);
  return (
    <div className="space-y-4" data-testid="evidence-panel">
      <section aria-labelledby="evidence-deliveries" className="space-y-1">
        <h3 id="evidence-deliveries" className="text-sm font-medium">Source deliveries</h3>
        {deliveries.length === 0 && <p className="text-xs text-muted-foreground">Entered manually — no source delivery.</p>}
        <ul className="space-y-2">
          {deliveries.map((revision) => (
            <Delivery key={revision.id} revision={revision} resolvers={resolvers} />
          ))}
        </ul>
      </section>
      <section aria-labelledby="evidence-lineage" className="space-y-1">
        <h3 id="evidence-lineage" className="text-sm font-medium">Lineage</h3>
        {history.relations.length === 0 && <p className="text-xs text-muted-foreground">Not split or merged.</p>}
        <ul className="space-y-1">
          {history.relations.map((relation) => {
            const { text, otherId } = relationText(relation, eventId);
            return (
              <li key={relation.id} className="text-xs">
                {text} another event on {resolvers.dateTime(relation.createdAt)} ·{' '}
                <Link className="underline" to={`/events/${otherId}`}>Open that event</Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
