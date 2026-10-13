export type CloseBlocker = 'ROOT_CAUSE_MISSING' | 'ACTIONS_NOT_DONE';

export interface CloseCandidate {
  rootCause: string | null;
  /** statuses of the case's actions (open | in_progress | done | cancelled) */
  actionStatuses: readonly string[];
}

const FINISHED_ACTIONS = new Set(['done', 'cancelled']);

/**
 * RCA-01 close gate (CAPA minimum): a case closes only with its root cause written down and every action
 * finished (done, or cancelled with its reason). Effectiveness verification and a second approver are
 * not required here (EXPERT_REVIEW Area 5, reliability-lead questions).
 */
export function closeBlockers(candidate: CloseCandidate): CloseBlocker[] {
  const blockers: CloseBlocker[] = [];
  if (!candidate.rootCause?.trim()) blockers.push('ROOT_CAUSE_MISSING');
  if (candidate.actionStatuses.some((status) => !FINISHED_ACTIONS.has(status)))
    blockers.push('ACTIONS_NOT_DONE');
  return blockers;
}
