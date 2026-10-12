import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SupportReference } from '@/features/ux-kit/errors';
import { StatusIcon } from '@/lib/icons';
import { issueText, problemText } from '../model/problem-text';
import type { WorkflowProblem } from '../model/workflow-errors';

const TITLES: Record<WorkflowProblem['kind'], string> = {
  run_changed: 'The calculation changed',
  stale_revision: 'Changed by someone else',
  content_changed: 'The reconciliation changed since you read it',
  line_issues: 'Some lines were not accepted — nothing was saved',
  gates: 'Cannot submit yet',
  duties: 'Separation of duties',
  stale_submission: 'Inputs changed after submission — recompute and resubmit',
  role: 'Your role does not allow this',
  network: 'Request failed',
  other: 'Refused — nothing was changed',
};

/** A refused workflow command in plain words, with its issue list; the code is only in `data-code` and the support reference. */
export function EditorProblem({ problem }: { problem: WorkflowProblem }) {
  const Icon = problem.kind === 'duties' || problem.kind === 'role' ? StatusIcon.locked : StatusIcon.warning;
  const reference = problem.status === null && !problem.correlationId ? null : { code: problem.code, status: problem.status, correlationId: problem.correlationId };
  return (
    <Alert variant="destructive" role="alert" data-testid="workflow-problem" data-kind={problem.kind} data-code={problem.code}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{TITLES[problem.kind]}</AlertTitle>
      <AlertDescription className="space-y-1">
        <p>{problemText(problem)}</p>
        {problem.kind !== 'line_issues' && problem.issues.length > 0 && (
          <ul className="list-disc pl-5 text-sm" data-testid="gate-issues">
            {problem.issues.map((issue) => (
              <li key={`${issue.code}-${issue.message}`} data-code={issue.code}>
                {issueText(issue)}
              </li>
            ))}
          </ul>
        )}
        <SupportReference reference={reference} />
      </AlertDescription>
    </Alert>
  );
}
