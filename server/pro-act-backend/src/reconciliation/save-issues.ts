import { allocationIssues } from '../domain/reconciliation/allocation-budget';
import {
  EventCandidate,
  eventConservationIssues,
} from '../domain/reconciliation/event-conservation';
import {
  DecisionLine,
  WorkflowIssue,
} from '../domain/reconciliation/reconciliation.types';
import { ShapedLine } from './line-shape';
import {
  candidatesOf,
  decOf,
  reconcileWith,
  RevisionState,
} from './revision-state';
import { Dec } from '../domain/actuals/decimal';

function eventCandidatesOf(state: RevisionState): EventCandidate[] {
  return state.candidateLines.map((line) => ({
    autoKey: line.autoKey ?? line.id,
    eventId: line.causeEventId,
    kind: line.kind,
    quantity: decOf(line.quantity) ?? new Dec(0),
  }));
}

/**
 * The arithmetic rules of a draft save, on the totals the saved set would give: the allocation budget of
 * each slice (§15.3) and the loss of each evidence event (SME R10, RC-04).
 */
export function saveIssues(
  state: RevisionState,
  shaped: readonly ShapedLine[],
  decisions: readonly DecisionLine[],
): WorkflowIssue[] {
  const reconciliation = reconcileWith(state, decisions);
  return [
    ...allocationIssues(reconciliation, decisions, {
      candidates: candidatesOf(state.candidateLines),
      rule: state.tolerance.rule,
    }),
    ...eventConservationIssues({
      candidates: eventCandidatesOf(state),
      outcomes: reconciliation.candidates,
      lines: shaped.map((line, i) => ({
        ...decisions[i],
        eventIds: line.input.eventIds ?? [],
      })),
      epsilon: state.tolerance.rule.epsilon,
    }),
  ];
}
