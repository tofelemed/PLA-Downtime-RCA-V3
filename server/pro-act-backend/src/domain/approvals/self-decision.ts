/**
 * Owner decision 2026-10-16 (Permanent SuperAdmin full workflow authority): a decision is self-decided when
 * its decider is also one of the parties it must otherwise be independent of (author, submitter, proposer,
 * investigator…). Everyone but an authenticated SuperAdmin is refused such a decision (403
 * SEPARATION_OF_DUTIES), so a stored self-decision marks a SuperAdmin deciding their own record. Item 1.3
 * shows it to auditors; it is derived from the stored actor ids, never sent by a client.
 */
export function isSelfDecision(
  decider: string | null | undefined,
  parties: ReadonlyArray<string | null | undefined>,
): boolean {
  if (!decider) return false;
  return parties.some((party) => party === decider);
}

/** A versioned record approved by its own author (approvedBy = createdBy). */
export function versionSelfApproved(row: {
  createdBy: string | null;
  approvedBy: string | null;
}): boolean {
  return isSelfDecision(row.approvedBy, [row.createdBy]);
}
