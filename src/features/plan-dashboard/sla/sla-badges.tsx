import { Badge } from '@/components/ui/badge';
import { roleLabel } from '@/features/ux-kit/labels';

export interface SlaFlags {
  overdue: boolean;
  onHold: boolean;
  escalationLevel: number;
  escalatedTo: string | null;
  rejections: number;
  rejectionEscalated: boolean;
}

/** Overdue, waiting, escalation and repeated rejection as badges — all server verdicts. */
export function SlaBadges({ sla }: { sla: SlaFlags }) {
  return (
    <span className="inline-flex flex-wrap gap-1" data-testid="sla-badges">
      {sla.overdue && (
        <Badge variant="destructive" data-testid="sla-overdue">
          Overdue
        </Badge>
      )}
      {sla.onHold && (
        <Badge variant="secondary" data-testid="sla-waiting">
          Waiting for data
        </Badge>
      )}
      {sla.escalationLevel > 0 && (
        <Badge variant="outline" data-testid="sla-escalated" data-level={sla.escalationLevel}>
          Escalated to {roleLabel(sla.escalatedTo)}
        </Badge>
      )}
      {sla.rejectionEscalated && (
        <Badge variant="outline" data-testid="sla-rejections">
          Rejected {sla.rejections}×
        </Badge>
      )}
    </span>
  );
}
