import { AlertTriangle, Lock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

/** A refused workflow command with the server's code, message, issue list and correlation id. */
export function EditorProblem({ problem }: { problem: WorkflowProblem }) {
  const Icon = problem.kind === 'duties' || problem.kind === 'role' ? Lock : AlertTriangle;
  return (
    <Alert variant="destructive" role="alert" data-testid="workflow-problem" data-kind={problem.kind} data-code={problem.code}>
      <Icon className="h-4 w-4" />
      <AlertTitle>
        {TITLES[problem.kind]} ({problem.code})
      </AlertTitle>
      <AlertDescription className="space-y-1">
        <p>{problem.message}</p>
        {problem.kind !== 'line_issues' && problem.issues.length > 0 && (
          <ul className="list-disc pl-5 text-sm" data-testid="gate-issues">
            {problem.issues.map((issue) => (
              <li key={`${issue.code}-${issue.message}`} data-code={issue.code}>
                {issue.code}: {issue.message}
              </li>
            ))}
          </ul>
        )}
        {problem.correlationId && <p className="text-xs">Reference: {problem.correlationId}</p>}
      </AlertDescription>
    </Alert>
  );
}
