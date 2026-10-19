import type { AnalyticsResponse } from '@/api/v2/types/envelopes';

type ProvisionalInput = Pick<AnalyticsResponse<unknown>, 'isProvisional'> & Partial<Pick<AnalyticsResponse<unknown>, 'coverage'>>;

/**
 * Whether shown figures are labelled "Provisional" (DECISIONS 2026-10-19, Reports coverage): with
 * "Approved revisions only" every figure shown is approved, and the periods still missing make the scope
 * incomplete (said by the coverage note), not provisional. Otherwise the server's flag. The page header and
 * every card use this one rule, so a card never says "Provisional" under an "Approved" header.
 */
export function shownAsProvisional(response: ProvisionalInput | undefined, approvedOnly: boolean): boolean | undefined {
  if (!response) return undefined;
  if (approvedOnly && response.coverage && response.coverage.ratio < 1) return false;
  return response.isProvisional;
}
