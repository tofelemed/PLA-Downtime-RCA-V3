import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { EntityIcon } from '@/lib/icons';
import { usePendingApprovalsCount } from './pending-approvals-badge';

const LABEL = 'Pending approvals';

function ApprovalsButton() {
  const count = usePendingApprovalsCount();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/approvals"
          aria-label={count ? `${LABEL}, ${count} pending` : LABEL}
          data-testid="header-approvals"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <EntityIcon.approvals className="h-5 w-5" aria-hidden />
          {count && (
            <span aria-hidden className="absolute right-0 top-0 rounded-full bg-warning px-1.5 text-xs font-semibold text-warning-foreground">
              {count}
            </span>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent>{LABEL}</TooltipContent>
    </Tooltip>
  );
}

/** The header's Pending approvals shortcut with the sidebar's "N" / "N+" count; only for users who can reach the approvals inbox. */
export function HeaderApprovals() {
  const { canReachApprovals } = useCapabilities();
  return canReachApprovals ? <ApprovalsButton /> : null;
}
