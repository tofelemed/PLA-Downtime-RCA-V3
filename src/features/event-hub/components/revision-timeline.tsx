import type { EventRevisionView, ProductionEventHistoryView } from '@/api/v2/types/events';
import {
  ACTOR_KIND_LABELS,
  labelOf,
  OEE_COMPONENT_LABELS,
  REVISION_KIND_LABELS,
  SCHEDULE_CLASS_LABELS,
  useUserNames,
} from '@/features/ux-kit/labels';
import { usePlantFormat } from '../hooks/use-plant-format';
import { useEventHubEnv } from '../use-event-hub-env';

/** Who made a revision: the user's name, else the connector or system label. */
function useActorText() {
  const users = useUserNames();
  return (revision: Pick<EventRevisionView, 'actorKind' | 'actorId'>) =>
    revision.actorKind === 'user' && revision.actorId ? users.nameOf(revision.actorId) : labelOf(ACTOR_KIND_LABELS, revision.actorKind);
}

/** Revisions (who changed what, why) and coding history, newest first (DT11 audit trail). */
export function RevisionTimeline({ history }: { history: ProductionEventHistoryView }) {
  const env = useEventHubEnv();
  const users = useUserNames();
  const { dateTime } = usePlantFormat();
  const actorText = useActorText();
  const revisions = [...history.revisions].sort((a, b) => b.revision - a.revision);
  const coding = [...history.coding].sort((a, b) => b.revision - a.revision);
  return (
    <div className="space-y-4">
      <section aria-labelledby="history-revisions" className="space-y-1">
        <h3 id="history-revisions" className="text-sm font-medium">Revisions</h3>
        <ol className="space-y-1 border-l pl-3" data-testid="revision-timeline">
          {revisions.map((revision) => (
            <li key={revision.id} className="text-xs">
              <span className="font-medium">Revision {revision.revision}</span> · {labelOf(REVISION_KIND_LABELS, revision.kind)} by {actorText(revision)} ·{' '}
              {dateTime(revision.createdAt)}
              {revision.changeReason && <span className="block text-muted-foreground">{revision.changeReason}</span>}
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="history-coding" className="space-y-1">
        <h3 id="history-coding" className="text-sm font-medium">Coding history</h3>
        {coding.length === 0 && <p className="text-xs text-muted-foreground">Never coded.</p>}
        <ol className="space-y-1 border-l pl-3">
          {coding.map((entry) => (
            <li key={entry.id} className="text-xs">
              <span className="font-medium">Coding {entry.revision}</span> · {env.reasonName(entry.reasonCodeId)} ·{' '}
              {labelOf(SCHEDULE_CLASS_LABELS, entry.scheduleClass)} / {labelOf(OEE_COMPONENT_LABELS, entry.oeeComponent)}
              {entry.isOverride && ' · changed by a user'}
              {entry.authorId && ` · by ${users.nameOf(entry.authorId)}`} · {dateTime(entry.createdAt)}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
