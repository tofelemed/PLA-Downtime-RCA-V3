import { Link } from 'react-router-dom';
import type { ApprovalAction, ApprovalItem } from '@/api/v2/types/approvals';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ApprovalDecisionDialog } from './approval-decision-dialog';

interface Props {
  item: ApprovalItem;
  onDecided: (action: ApprovalAction) => void;
}

/**
 * The decisions this record's workflow offers the signed-in user (the existing approve / reject / return /
 * retire / activate commands; retire only where the lifecycle has it), with the full workspace as the
 * secondary way — the only way for reviews whose evidence and gates live there.
 */
export function ApprovalDetailActions({ item, onDecided }: Props) {
  const { isSuperAdmin } = useCapabilities();
  const open = item.actions.filter((action) => !action.disabledReason);
  const workspaceOnly = item.actions.length === 0;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="approval-detail-actions">
      {open.map((action) => (
        <ApprovalDecisionDialog key={action.action} item={item} action={action.action} onDecided={onDecided} />
      ))}
      <Button size="sm" variant={workspaceOnly ? 'default' : 'outline'} asChild>
        <Link to={item.reviewHref}>{workspaceOnly ? (isSuperAdmin ? 'Review & decide in workspace' : 'Open review workspace') : 'Open full workspace'}</Link>
      </Button>
    </div>
  );
}
