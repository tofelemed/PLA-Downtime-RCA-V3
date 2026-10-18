import type { RcaEvidenceItem } from '@/api/v2/types/rca';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { StatusIcon } from '@/lib/icons';
import { isEvidenceTaskOverdue } from '../../model/due-date';
import { useRcaFormat } from '../../use-rca-format';

/** F-11: "Overdue" (icon and words) on an evidence collection task past its due day and not completed. */
export function TaskOverdueBadge({ item }: { item: Pick<RcaEvidenceItem, 'taskDueDate' | 'taskStatus'> }) {
  const { timezone } = useRcaFormat();
  if (!isEvidenceTaskOverdue(item, timezone)) return null;
  return (
    <StatusBadge tone="danger" icon={StatusIcon.warning} className="ml-1" data-testid="evidence-task-overdue">
      Overdue
    </StatusBadge>
  );
}
