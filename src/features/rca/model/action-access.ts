import type { RcaActionView } from '@/api/v2/types/rca';

/** What the signed-in user may do with one action (the server decides again on every PATCH). */
export interface ActionAccess {
  /** RCA writer: plans and edits every field, marks done (never as the owner), verifies */
  canPlan: boolean;
  /** works the action: status open / in progress and completion evidence (writers, or its owner) */
  canWork: boolean;
  /** works it only as its owner (not an RCA writer): evidence and progress, never type, date or done */
  ownerOnly: boolean;
}

/** Nothing to do with the action (QA H1: an action of a closed investigation). */
export const NO_ACTION_ACCESS: ActionAccess = { canPlan: false, canWork: false, ownerOnly: false };

const UNFINISHED = new Set(['open', 'in_progress']);

/**
 * Owner rule (Marun E2E, plans/DECISIONS.md): the owner of an action who is not an RCA writer may move it
 * between open and in progress and record its completion evidence while it is unfinished.
 */
export function actionAccessOf(action: Pick<RcaActionView, 'ownerId' | 'status'>, input: { canWriteRca: boolean; userId: string | null }): ActionAccess {
  if (input.canWriteRca) return { canPlan: true, canWork: action.status !== 'cancelled', ownerOnly: false };
  const owner = Boolean(input.userId) && action.ownerId === input.userId && UNFINISHED.has(action.status);
  return { canPlan: false, canWork: owner, ownerOnly: owner };
}

/** The statuses the status control offers. */
export function statusChoices<T extends string>(all: readonly T[], access: ActionAccess, current: string): T[] {
  if (!access.ownerOnly) return [...all];
  return all.filter((status) => UNFINISHED.has(status) || status === current);
}
