import { ERROR_MESSAGES, isHumanMessage } from '@/features/ux-kit/errors';
import type { WorkflowProblem } from './workflow-errors';

/** Plain text of a server issue: the mapped text of its code, else the server's sentence, never the code. */
export function issueText(issue: { code: string; message: string | null }): string {
  const mapped = ERROR_MESSAGES[issue.code]?.text;
  if (mapped) return mapped;
  return isHumanMessage(issue.message, issue.code) ? issue.message : 'This line was not accepted.';
}

/** Plain text of the problem itself (same rule as its issues). */
export function problemText(problem: WorkflowProblem): string {
  const mapped = ERROR_MESSAGES[problem.code]?.text;
  if (mapped) return mapped;
  return isHumanMessage(problem.message, problem.code) ? problem.message : 'The server refused this action; nothing was changed.';
}
