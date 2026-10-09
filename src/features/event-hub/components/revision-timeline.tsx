import type { ProductionEventHistoryView } from '@/api/v2/types/events';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { humanize } from '../model/event-states';
import { useEventHubEnv } from '../use-event-hub-env';

/** Revisions (who changed what, why) and coding history, newest first (DT11 audit trail). */
export function RevisionTimeline({ history }: { history: ProductionEventHistoryView }) {
  const env = useEventHubEnv();
  const revisions = [...history.revisions].sort((a, b) => b.revision - a.revision);
  const coding = [...history.coding].sort((a, b) => b.revision - a.revision);
  return (
    <div className="space-y-4">
      <section aria-label="Revisions">
        <h4 className="mb-1 text-sm font-medium">Revisions</h4>
        <ol className="space-y-1 border-l pl-3" data-testid="revision-timeline">
          {revisions.map((revision) => (
            <li key={revision.id} className="text-xs">
              <span className="font-medium">r{revision.revision}</span> · {humanize(revision.kind)} by {revision.actorKind}
              {' · '}
              <PlantTime iso={revision.createdAt} tz={env.timezone} withDate />
              {revision.changeReason && <span className="block text-muted-foreground">{revision.changeReason}</span>}
            </li>
          ))}
        </ol>
      </section>
      <section aria-label="Coding history">
        <h4 className="mb-1 text-sm font-medium">Coding history</h4>
        {coding.length === 0 && <p className="text-xs text-muted-foreground">Never coded.</p>}
        <ol className="space-y-1 border-l pl-3">
          {coding.map((entry) => (
            <li key={entry.id} className="text-xs">
              <span className="font-medium">c{entry.revision}</span> · {env.reasonName(entry.reasonCodeId)} ·{' '}
              {humanize(entry.scheduleClass)} / {humanize(entry.oeeComponent)}
              {entry.isOverride && ' · override'}
              {' · '}
              <PlantTime iso={entry.createdAt} tz={env.timezone} withDate />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
