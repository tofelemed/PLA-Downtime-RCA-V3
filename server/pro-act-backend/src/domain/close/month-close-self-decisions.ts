/** One recorded month-close step (`month_close_actions`), as far as independence needs it. */
export interface MonthCloseStep {
  id: string;
  action: string;
  actorId: string | null;
  createdAt: Date;
}

const chronological = (a: MonthCloseStep, b: MonthCloseStep) =>
  a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

/**
 * Item 1.3: ids of the steps that were self-decided under the SME R1 segregation the close machine applies
 * (`decideMonthClose`): a materiality review by the quantity closer, or a finance sign-off by the quantity
 * closer or the materiality reviewer of the same cycle. A reopen starts a new cycle. Only a SuperAdmin is
 * allowed such a step (owner decision 2026-10-16). Steps older than the history read are not seen.
 */
export function monthCloseSelfDecisions(
  history: readonly MonthCloseStep[],
): Set<string> {
  const self = new Set<string>();
  let closer: string | null = null;
  let reviewer: string | null = null;
  for (const step of [...history].sort(chronological)) {
    const actor = step.actorId;
    if (step.action === 'close_quantities') [closer, reviewer] = [actor, null];
    if (step.action === 'reopen') [closer, reviewer] = [null, null];
    if (step.action === 'review_materiality') {
      if (actor && actor === closer) self.add(step.id);
      reviewer = actor;
    }
    if (
      step.action === 'sign_off_finance' &&
      actor &&
      (actor === closer || actor === reviewer)
    )
      self.add(step.id);
  }
  return self;
}
