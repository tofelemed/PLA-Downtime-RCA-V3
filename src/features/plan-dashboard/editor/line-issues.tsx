import { Quantity } from '@/features/ux-kit/quantity';
import type { WorkflowIssue } from '../model/workflow-errors';
import { issueText } from '../model/problem-text';

export interface LineIssuesProps {
  /** missing fields found before sending */
  problems: string[];
  /** the server's 422 issues for this line (code, message, remaining allocation) */
  issues: WorkflowIssue[];
  uom: string | null;
}

/** Inline problems of one editor line; the remaining allocation is the server's budget, never ours. */
export function LineIssues({ problems, issues, uom }: LineIssuesProps) {
  if (!problems.length && !issues.length) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-destructive" role="alert" data-testid="line-issues">
      {problems.map((p) => (
        <li key={p}>{p}</li>
      ))}
      {issues.map((issue) => (
        <li key={`${issue.code}-${issue.message}`} data-testid="line-issue" data-code={issue.code}>
          {issueText(issue)}
          {issue.expectedRemainingAllocation !== undefined && (
            <>
              {' '}
              — still available to allocate: <Quantity value={issue.expectedRemainingAllocation} uom={uom} />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
