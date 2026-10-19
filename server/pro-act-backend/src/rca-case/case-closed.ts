import { ConflictException } from '@nestjs/common';
import { statusOf } from '../domain/rca/case-workflow';

/** What a closed-case refusal tells the client (also the UI notice wording). */
export const CASE_CLOSED_MESSAGE =
  'The investigation is closed; reopen it to change it';

/** True for an investigation whose closure was approved (QA H1: closed records are frozen). */
export const isCaseClosed = (rca: { status?: string | null }): boolean =>
  statusOf(rca.status ?? null) === 'Closed';

/**
 * 409 CASE_CLOSED (QA audit H1, DECISIONS 2026-10-19 "Closed records are frozen"): a closed investigation
 * is read-only — its definition, evidence, analyses, causes, recommendations, actions, links, files and
 * tasks were approved as they stand. Reopening it (POST /v2/rcas/{id}/transitions, independent approver)
 * is the only way to change it again.
 */
export function assertCaseNotClosed(
  rca: { status?: string | null },
  message: string = CASE_CLOSED_MESSAGE,
): void {
  if (!isCaseClosed(rca)) return;
  throw new ConflictException({ code: 'CASE_CLOSED', message });
}
