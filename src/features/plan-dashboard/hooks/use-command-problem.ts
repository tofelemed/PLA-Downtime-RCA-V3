import { useState } from 'react';
import { workflowProblemOf, type WorkflowProblem } from '../model/workflow-errors';

/** Server refusals of a command shown beside it; the promise still rejects (its dialog stays open). */
export function useCommandProblem() {
  const [problem, setProblem] = useState<WorkflowProblem | null>(null);
  const track = (command: Promise<unknown>) =>
    command.then(
      () => setProblem(null),
      (error: unknown) => {
        setProblem(workflowProblemOf(error));
        throw error;
      },
    );
  return { problem, track };
}
