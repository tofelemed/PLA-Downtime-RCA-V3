/** Wording of a SuperAdmin self-decision badge: an approval, or another decision (rejection, review, sign-off). */
export type SelfDecisionKind = 'approved' | 'decided';

/** The badge wording for a record state: a rejection is "decided", anything else "approved". */
export function selfDecisionKindOf(state: string | null | undefined): SelfDecisionKind {
  return state === 'rejected' ? 'decided' : 'approved';
}
