import type { ApprovalAction, ApprovalItem } from '@/api/v2/types/approvals';
import { ApprovalDecisionDialog } from './approval-decision-dialog';

interface Props {
  item: ApprovalItem;
  onDecided: (action: ApprovalAction) => void;
}

/**
 * The decisions this record's workflow offers the signed-in user (the existing approve / reject / return /
 * retire / activate commands; retire only where the lifecycle has it).
 */
export function ApprovalDetailActions({ item, onDecided }: Props) {
  const open = item.actions.filter((action) => !action.disabledReason);
  if (open.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="approval-detail-actions">
      {open.map((action) => (
        <ApprovalDecisionDialog key={action.action} item={item} action={action.action} onDecided={onDecided} />
      ))}
    </div>
  );
}
