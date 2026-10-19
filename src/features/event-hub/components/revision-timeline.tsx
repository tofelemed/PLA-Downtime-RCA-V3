import type { EventRevisionView, ProductionEventHistoryView } from '@/api/v2/types/events';
import {
  actorText,
  humanize,
  SERVICE_LABELS,
  labelOf,
  OEE_COMPONENT_LABELS,
  REVISION_KIND_LABELS,
  SCHEDULE_CLASS_LABELS,
  useUserNames,
} from '@/features/ux-kit/labels';
import { usePlantFormat } from '../hooks/use-plant-format';
import { revisionNoteText } from '../model/revision-notes';
import { useEventHubEnv } from '../use-event-hub-env';

/** A system revision of a named service (data repair, split / merge, …): QA L18. */
function systemWork(revision: EventRevisionView): string | null {
  if (revision.kind !== 'system' || revision.actorKind === 'user' || !revision.actorSource) return null;
  const label = revision.actorSource in SERVICE_LABELS ? SERVICE_LABELS[revision.actorSource] : humanize(revision.actorSource);
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : null;
}

/** "Data repair by the system", never "System change by System (data repair)". */
const kindText = (revision: EventRevisionView) => systemWork(revision) ?? labelOf(REVISION_KIND_LABELS, revision.kind);

/** Revisions (who changed what, why) and coding history, newest first (DT11 audit trail). */
export function RevisionTimeline({ history, sourceName }: { history: ProductionEventHistoryView; sourceName?: string | null }) {
  const env = useEventHubEnv();
  const users = useUserNames([...history.revisions.map((r) => r.actorId), ...history.coding.map((c) => c.authorId)]);
  const { dateTime } = usePlantFormat();
  const actorOf = (revision: EventRevisionView) =>
    systemWork(revision)
      ? 'the system'
      : actorText({ kind: revision.actorKind, id: revision.actorId, source: revision.actorSource ?? (revision.actorKind === 'connector' ? sourceName : null) }, users.nameOf);
  const revisions = [...history.revisions].sort((a, b) => b.revision - a.revision);
  const coding = [...history.coding].sort((a, b) => b.revision - a.revision);
  return (
    <div className="space-y-4">
      <section aria-labelledby="history-revisions" className="space-y-1">
        <h3 id="history-revisions" className="text-sm font-medium">Revisions</h3>
        <ol className="space-y-1 border-l pl-3" data-testid="revision-timeline">
          {revisions.map((revision) => (
            <li key={revision.id} className="text-xs">
              <span className="font-medium">Revision {revision.revision}</span> · {kindText(revision)} by <span data-testid="revision-actor">{actorOf(revision)}</span> ·{' '}
              {dateTime(revision.createdAt)}
              {revision.changeReason && <span className="block text-muted-foreground" data-testid="revision-note">{revisionNoteText(revision.changeReason)}</span>}
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
              {entry.isOverride && ' · classification set manually'}
              {' · by '}
              <span data-testid="coding-actor">{actorText({ id: entry.authorId, source: entry.authorSource }, users.nameOf)}</span> · {dateTime(entry.createdAt)}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
