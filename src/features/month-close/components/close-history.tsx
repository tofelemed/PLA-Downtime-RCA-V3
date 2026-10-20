import type { MonthCloseView } from '@/api/v2/types/month-close';
import { resolvedActorText } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Section } from '@/features/ux-kit/page-layout';
import { SelfDecisionBadge } from '@/features/ux-kit/self-decision-badge';
import { CLOSE_ACTION_LABELS } from '../model/close-labels';

/** The month's close steps, newest first (who, when, comment or reason). */
export function CloseHistory({ view }: { view: MonthCloseView }) {
  return (
    <Section title="History" description="Recorded month-close steps, newest first.">
      {view.history.length === 0 ? <p data-testid="close-history-empty">No month-close actions recorded.</p> : <ol className="space-y-2 text-sm break-words" data-testid="close-history">
        {view.history.map((h) => (
          <li key={h.id}>
            <PlantTime iso={h.createdAt} tz={view.deadlines.timezone} withDate /> — {CLOSE_ACTION_LABELS[h.action] ?? h.action} by {resolvedActorText(h.actor?.id, h.actor?.name)}
            {h.reason ? `: ${h.reason}` : ''}
            <SelfDecisionBadge selfDecided={h.selfDecided} kind="decided" className="ml-2" />
          </li>
        ))}
      </ol>}
    </Section>
  );
}
