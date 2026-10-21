import { roleLabel } from '@/features/ux-kit/labels';
import { NumberText } from '@/features/ux-kit/number-text';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { StatusIcon } from '@/lib/icons';

export interface SlaFlags {
  overdue: boolean;
  onHold: boolean;
  escalationLevel: number;
  escalatedTo: string | null;
  rejections: number;
  rejectionEscalated: boolean;
}

/**
 * Overdue, waiting, escalation and repeated rejection as badges — all server verdicts. Only Overdue is red
 * (§5.8, C-5); escalation says who acts now (information, not an alarm).
 */
export function SlaBadges({ sla }: { sla: SlaFlags }) {
  return (
    <span className="inline-flex flex-wrap gap-1" data-testid="sla-badges">
      {sla.overdue && (
        <StatusBadge tone="danger" icon={StatusIcon.warning} data-testid="sla-overdue">
          Overdue
        </StatusBadge>
      )}
      {sla.onHold && (
        <StatusBadge tone="neutral" data-testid="sla-waiting">
          Waiting for data
        </StatusBadge>
      )}
      {sla.escalationLevel > 0 && (
        <StatusBadge tone="info" data-testid="sla-escalated" data-level={sla.escalationLevel}>
          Escalated to {roleLabel(sla.escalatedTo)}
        </StatusBadge>
      )}
      {sla.rejectionEscalated && (
        <StatusBadge tone="neutral" data-testid="sla-rejections">
          Rejected <NumberText value={sla.rejections} />×
        </StatusBadge>
      )}
    </span>
  );
}
