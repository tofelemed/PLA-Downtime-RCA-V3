import { Link } from 'react-router-dom';
import type { ApprovalItem } from '@/api/v2/types/approvals';
import { Button } from '@/components/ui/button';
import { ApprovalDecisionDialog } from './approval-decision-dialog';
import { approvalHref } from './approval-links';
import { ChangeHeadline } from './changes/change-headline';

/** Primary action first: decide on the approval page (or quick-decide a plain version), then the workspace. */
export function RowActions({ item }: { item: ApprovalItem }) {
  const quick = item.actions.filter((action) => !action.disabledReason);
  const verb = item.canDecide ? 'Review & decide' : 'View';
  const blocked = item.decisionBlockedReason ?? item.actions.find((action) => action.disabledReason)?.disabledReason;
  return (
    <div className="space-y-2">
      <div className="flex flex-nowrap gap-2">
        <Button size="sm" variant={item.canDecide ? 'default' : 'outline'} asChild>
          <Link to={approvalHref(item)} aria-label={`${verb} ${item.title}`}>{verb}</Link>
        </Button>
        {quick.map((action) => <ApprovalDecisionDialog key={action.action} item={item} action={action.action} />)}
        <Button size="sm" variant="ghost" asChild>
          <Link to={item.reviewHref}>Open workspace</Link>
        </Button>
      </div>
      {blocked && <p className="text-xs text-muted-foreground">{blocked}</p>}
    </div>
  );
}

/** What needs approval: the record and its one-line change; the summary and version are on its approval page. */
export function RecordCell({ item }: { item: ApprovalItem }) {
  return (
    <div className="max-w-md space-y-1">
      <Link className="font-medium underline-offset-4 hover:underline" to={approvalHref(item)}>{item.title}</Link>
      {item.headline && <ChangeHeadline field={item.headline} />}
    </div>
  );
}
