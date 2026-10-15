/** Case statuses (v1 strings kept; `Published` is a v1 status read as an analysis-stage case). */
export const RCA_STATUSES = [
  'Draft',
  'In Progress',
  'Analysis',
  'Published',
  'Monitoring',
  'Closure Review',
  'Closed',
] as const;
export type RcaStatus = (typeof RCA_STATUSES)[number];

/** Statuses a case may be opened in. */
export const START_STATUSES: readonly RcaStatus[] = ['Draft', 'In Progress'];

/**
 * What a move needs beside the writer role:
 * - `investigation`: CA1 "investigation accepted" — root cause, method tier (CA7), 5-Why (CA6), FMEA (CA5)
 * - `closure_request`: actions finished with evidence (CA4), effectiveness verified (CA2), residual risk
 * - `independent_approval`: a manager approver who is not an investigator of the case (CA1)
 * - `note`: a reason is written (rejection, reopening, going back)
 */
export type TransitionGate =
  | 'investigation'
  | 'closure_request'
  | 'independent_approval'
  | 'note';

export interface Transition {
  from: RcaStatus;
  to: RcaStatus;
  gates: readonly TransitionGate[];
}

const T = (
  from: RcaStatus,
  to: RcaStatus,
  ...gates: TransitionGate[]
): Transition => ({
  from,
  to,
  gates,
});

/**
 * RCA-01 / CA1 state machine: investigation → actions → effectiveness monitoring → independent closure.
 * A case never jumps to Closed; only Closure Review closes, approved by someone independent of the
 * investigation. Closure Review back to Monitoring is the reviewer's rejection; Closed back to Analysis
 * is a reopening. Every other pair is refused (422 INVALID_TRANSITION).
 */
export const TRANSITIONS: readonly Transition[] = [
  T('Draft', 'In Progress'),
  T('In Progress', 'Draft'),
  T('In Progress', 'Analysis'),
  T('Analysis', 'In Progress'),
  T('Analysis', 'Monitoring', 'investigation'),
  T('Published', 'In Progress'),
  T('Published', 'Analysis'),
  T('Published', 'Monitoring', 'investigation'),
  T('Monitoring', 'Analysis', 'note'),
  T('Monitoring', 'Closure Review', 'closure_request'),
  T('Closure Review', 'Monitoring', 'independent_approval', 'note'),
  T('Closure Review', 'Closed', 'independent_approval'),
  T('Closed', 'Analysis', 'independent_approval', 'note'),
];

/** Statuses after the investigation was accepted: the team is frozen (CA1 independence). */
export const TEAM_LOCKED_STATUSES: readonly RcaStatus[] = [
  'Monitoring',
  'Closure Review',
  'Closed',
];

/** The append-only participant list after adding `ids` (nulls ignored, order of first appearance kept). */
export function withInvestigators(
  current: readonly string[] | null | undefined,
  ids: ReadonlyArray<string | null | undefined>,
): string[] {
  return [
    ...new Set([
      ...(current ?? []),
      ...ids.filter((id): id is string => Boolean(id)),
    ]),
  ];
}

/** Legacy rows without a status are drafts. */
export function statusOf(stored: string | null | undefined): RcaStatus {
  return (RCA_STATUSES as readonly string[]).includes(stored ?? '')
    ? (stored as RcaStatus)
    : 'Draft';
}

export function transitionOf(
  from: RcaStatus,
  to: RcaStatus,
): Transition | null {
  return (
    TRANSITIONS.find((entry) => entry.from === from && entry.to === to) ?? null
  );
}

export function nextStatuses(from: RcaStatus): RcaStatus[] {
  return TRANSITIONS.filter((entry) => entry.from === from).map(
    (entry) => entry.to,
  );
}

/** The people who took part in the investigation of a case (never its closure approver). */
export interface CaseParties {
  createdBy: string | null;
  teamLeadId: string | null;
  teamMemberIds: readonly string[];
  closureRequestedBy: string | null;
  /** append-only: everyone who ever opened, led, joined or requested closure of the case */
  pastInvestigators: readonly string[];
}

export type IndependenceConflict =
  | 'creator'
  | 'team_lead'
  | 'team_member'
  | 'closure_requester'
  | 'past_investigator';

/** CA1: the approver must not be the case's author, lead, a team member or whoever asked for closure. */
export function independenceConflict(
  approver: string,
  parties: CaseParties,
): IndependenceConflict | null {
  if (parties.createdBy === approver) return 'creator';
  if (parties.teamLeadId === approver) return 'team_lead';
  if (parties.teamMemberIds.includes(approver)) return 'team_member';
  if (parties.closureRequestedBy === approver) return 'closure_requester';
  if (parties.pastInvestigators.includes(approver)) return 'past_investigator';
  return null;
}
