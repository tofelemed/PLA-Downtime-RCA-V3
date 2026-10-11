/**
 * Whether an approve control is offered: hidden when the role can never approve, disabled with the
 * separation-of-duties reason when the viewer authored what is to be approved (403
 * SEPARATION_OF_DUTIES), offered otherwise. An unknown author or user leaves the decision to the server.
 */
export type ApprovalAccess = 'hidden' | 'own' | 'allowed';

export const SEPARATION_OF_DUTIES_HINT = 'You authored this: another approver must approve it (separation of duties).';

export function approvalAccess(canApprove: boolean, authorId: string | null | undefined, userId: string | null | undefined): ApprovalAccess {
  if (!canApprove) return 'hidden';
  if (authorId && userId && authorId === userId) return 'own';
  return 'allowed';
}
