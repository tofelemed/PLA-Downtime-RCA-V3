import { revisionSelfApproved } from '../domain/reconciliation/self-approval';
import { ReviewedSnapshot } from './export-report';

/** Who else took part in the approved revision, read with the pinned source (immutable once approved). */
export interface SourceParties {
  /** who opened the revision of an approved period (null for a first revision) */
  opener: string | null;
  /** who gave the approved submission its bridge second review (null without one) */
  bridgeReviewer: string | null;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

/**
 * Item 1.3: whether an approval snapshot was self-approved — its approver also submitted it, opened the
 * revision, authored one of its lines or reviewed its bridges (SuperAdmin only, owner decision 2026-10-16).
 * Read from the immutable snapshot and revision, so re-rendering a job reproduces the same bytes.
 */
export function snapshotSelfApproved(
  content: Record<string, unknown>,
  reviewed: ReviewedSnapshot,
  parties: SourceParties,
): boolean {
  return revisionSelfApproved(text(content.approvedBy), {
    submittedBy: text(content.submittedBy),
    revisionOpenedBy: parties.opener,
    lineAuthors: reviewed.lines.map((line) => line.authorId ?? null),
    bridgeReviewer: parties.bridgeReviewer,
  });
}
