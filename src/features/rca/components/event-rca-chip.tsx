import { Link } from 'react-router-dom';
import { EVENT_RCA_STATE_LABELS } from '@/features/ux-kit/labels';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import type { StatusTone } from '@/features/ux-kit/status-tone';
import { StatusIcon } from '@/lib/icons';

export interface EventRcaChipProps {
  /** the event's RCA state from the server (`none`, `required`, `linked`, `completed`) */
  rcaState: string | null | undefined;
  /** the investigation the event is linked to, when there is one */
  caseId?: string | null;
}

const CASE_CHIPS: Readonly<Record<string, { text: string; tone: StatusTone }>> = {
  linked: { text: EVENT_RCA_STATE_LABELS.linked, tone: 'info' },
  completed: { text: EVENT_RCA_STATE_LABELS.completed, tone: 'success' },
};

/**
 * G-4: the RCA chip of an event wherever it appears (bad actors, loss lines, drill lists): a linked or
 * completed investigation is a link to `/rca/:id` (a plain chip when the view carries no investigation
 * id); an event the server marked `required` shows "Investigation recommended" (glossary words from ux-kit); otherwise nothing. The state is
 * the server's; nothing is decided here.
 */
export function EventRcaChip({ rcaState, caseId }: EventRcaChipProps) {
  if (caseId) {
    const chip = CASE_CHIPS[rcaState ?? ''] ?? CASE_CHIPS.linked;
    return (
      <Link to={`/rca/${encodeURIComponent(caseId)}`} className="w-fit rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="event-rca-chip">
        <StatusBadge tone={chip.tone} icon={chip.tone === 'success' ? StatusIcon.success : StatusIcon.info}>
          {chip.text}
          <span className="sr-only"> (open it)</span>
        </StatusBadge>
      </Link>
    );
  }
  const unlinked = CASE_CHIPS[rcaState ?? ''];
  if (unlinked) {
    return (
      <StatusBadge tone={unlinked.tone} icon={unlinked.tone === 'success' ? StatusIcon.success : StatusIcon.info} className="w-fit" data-testid="event-rca-chip">
        {unlinked.text}
      </StatusBadge>
    );
  }
  if (rcaState !== 'required') return null;
  return (
    <StatusBadge tone="info" icon={StatusIcon.info} className="w-fit" data-testid="event-rca-chip">
      {EVENT_RCA_STATE_LABELS.required}
    </StatusBadge>
  );
}
