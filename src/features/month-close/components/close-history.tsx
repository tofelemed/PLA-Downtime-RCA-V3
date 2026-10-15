import type { MonthCloseView } from '@/api/v2/types/month-close';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Section } from '@/features/ux-kit/page-layout';
import { CLOSE_ACTION_LABELS } from '../model/close-labels';

/** The month's close steps, newest first (who, when, comment or reason). */
export function CloseHistory({ view }: { view: MonthCloseView }) {
  if (view.history.length === 0) return null;
  return (
    <Section title="History" collapsible defaultOpen={false}>
      <ol className="space-y-1 text-sm" data-testid="close-history">
        {view.history.map((h) => (
          <li key={h.id}>
            <PlantTime iso={h.createdAt} tz={view.deadlines.timezone} withDate /> — {CLOSE_ACTION_LABELS[h.action] ?? h.action} by {h.actor?.name ?? 'a user'}
            {h.reason ? `: ${h.reason}` : ''}
          </li>
        ))}
      </ol>
    </Section>
  );
}
