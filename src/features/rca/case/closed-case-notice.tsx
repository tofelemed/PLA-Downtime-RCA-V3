import { Link, useLocation } from 'react-router-dom';
import { StatusIcon } from '@/lib/icons';
import { CLOSED_CASE_NOTICE } from '../model/closed-case';
import { useCaseWorkspace } from './case-context';
import { WORKFLOW_ANCHOR } from './workflow/workflow-anchor';

/**
 * QA H1: one slim banner under the tabs telling an RCA writer why a closed investigation shows no edit
 * controls, with a link to the Workflow on Overview (where an independent manager approver may reopen it).
 */
export function ClosedCaseNotice() {
  const { closed, canWrite, basePath } = useCaseWorkspace();
  const { search } = useLocation();
  if (!closed || !canWrite) return null;
  return (
    <div role="note" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-muted/50 px-3 py-2 text-sm" data-testid="closed-case-notice">
      <span className="inline-flex items-center gap-2">
        <StatusIcon.locked className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        {CLOSED_CASE_NOTICE}
      </span>
      <Link className="font-medium underline" to={`${basePath}${search}#${WORKFLOW_ANCHOR}`}>
        Go to workflow
      </Link>
    </div>
  );
}
