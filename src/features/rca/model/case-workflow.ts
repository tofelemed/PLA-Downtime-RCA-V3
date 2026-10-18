import type { RcaTransitionBody } from '@/api/v2/queries/rca-commands';
import type { RcaStatus } from '@/api/v2/types/rca';
import type { RcaCaseReadinessView, RcaGateIssue } from '@/api/v2/types/rca-workflow';

/** Statuses after the investigation was accepted: the team is fixed (CA1 independence of the approver). */
export const TEAM_LOCKED_STATUSES: readonly string[] = ['Monitoring', 'Closure Review', 'Closed'];

/** One move the server offers from the current status, with what the screen must collect for it. */
export interface WorkflowMove {
  to: RcaStatus;
  label: string;
  /** a reason is written (rejection, reopening, going back) */
  needsNote: boolean;
  /** closure request: the residual risk disposition */
  needsResidualRisk: boolean;
  /** only an independent manager approver may make it */
  needsApprover: boolean;
  /** the server checks the investigation gate (CA5–CA7) or the closure gate (CA2, CA4) */
  gate: 'investigation' | 'closure' | null;
}

const LABELS: Readonly<Record<string, string>> = {
  'Draft>In Progress': 'Start the investigation',
  'In Progress>Draft': 'Back to draft',
  'In Progress>Analysis': 'Move to analysis',
  'Analysis>In Progress': 'Back to investigation',
  'Analysis>Monitoring': 'Accept the investigation and start monitoring',
  'Published>In Progress': 'Back to investigation',
  'Published>Analysis': 'Move to analysis',
  'Published>Monitoring': 'Accept the investigation and start monitoring',
  'Monitoring>Analysis': 'Back to analysis',
  'Monitoring>Closure Review': 'Request closure',
  'Closure Review>Monitoring': 'Reject the closure',
  'Closure Review>Closed': 'Approve the closure',
  'Closed>Analysis': 'Reopen the investigation',
};

function gateOf(to: RcaStatus, gates: readonly string[]): WorkflowMove['gate'] {
  if (gates.includes('investigation')) return 'investigation';
  return gates.includes('closure_request') || to === 'Closed' ? 'closure' : null;
}

/** The moves of a readiness answer in the server's order, labelled for the buttons. */
export function workflowMoves(readiness: Pick<RcaCaseReadinessView, 'status' | 'next'>): WorkflowMove[] {
  return readiness.next.map(({ to, gates }) => ({
    to,
    label: LABELS[`${readiness.status}>${to}`] ?? `Move to ${to}`,
    needsNote: gates.includes('note'),
    needsResidualRisk: gates.includes('closure_request'),
    needsApprover: gates.includes('independent_approval'),
    gate: gateOf(to, gates),
  }));
}

/**
 * Blockers the server reported for the gate of a move. The residual-risk blocker of a closure request is
 * met by the text typed with the request, so it no longer blocks once that text is there.
 */
export function blockersOf(move: WorkflowMove, readiness: RcaCaseReadinessView, residualRisk: string): RcaGateIssue[] {
  if (move.gate === 'investigation') return readiness.investigation.blockers;
  if (move.gate !== 'closure') return [];
  const typed = residualRisk.trim() !== '';
  return readiness.closure.blockers.filter((issue) => !(move.needsResidualRisk && typed && issue.field === 'residualRisk'));
}

/** The transition body: the target plus the note and residual risk the move asks for (trimmed). */
export function transitionBody(move: WorkflowMove, input: { note: string; residualRisk: string }): RcaTransitionBody {
  const note = input.note.trim();
  const residualRisk = input.residualRisk.trim();
  return {
    to: move.to,
    ...(note ? { note } : {}),
    ...(move.needsResidualRisk && residualRisk ? { residualRisk } : {}),
  };
}

/** True when the move has what it needs on screen (the server re-checks every gate). */
export function moveReady(move: WorkflowMove, blockers: readonly RcaGateIssue[], input: { note: string; residualRisk: string }): boolean {
  if (blockers.length > 0) return false;
  if (move.needsNote && input.note.trim() === '') return false;
  return !(move.needsResidualRisk && input.residualRisk.trim() === '');
}

/** A test-id safe slug of a status (`Closure Review` → `closure-review`). */
export const statusSlug = (status: string) => status.toLowerCase().replace(/\s+/g, '-');

/** What a move commits the case to, said before it runs (irreversible without a manager approver). */
export interface MoveConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
}

/** The confirmation of an accept, closure request or closure approval; null for other moves. */
export function moveConfirmation(move: Pick<WorkflowMove, 'to' | 'needsResidualRisk'>, from: string): MoveConfirmation | null {
  if (move.to === 'Monitoring' && from !== 'Closure Review') {
    return {
      title: 'Accept the investigation?',
      description: 'The investigation team is locked from now on, so the closure approver can be judged independent of it. It moves to monitoring while the actions are verified; changing the team needs the investigation reopened.',
      confirmLabel: 'Accept the investigation',
    };
  }
  if (move.to === 'Closure Review' && move.needsResidualRisk) {
    return {
      title: 'Request closure?',
      description: 'The effectiveness verdict is frozen as it stands and sent with the residual risk to an independent manager approver. Edits to the actions no longer change the verdict under review.',
      confirmLabel: 'Request closure',
    };
  }
  if (move.to === 'Closed') {
    return {
      title: 'Approve the closure?',
      description: 'The investigation is closed and the RCA state of its linked events becomes completed. Reopening it later needs a manager approver and a reason.',
      confirmLabel: 'Approve the closure',
    };
  }
  return null;
}
