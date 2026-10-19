import type { LinesWithoutEventQuery } from '@/api/v2/queries/pla-analytics';
import type { LineWithoutEventView } from '@/api/v2/types/pla-analytics';
import { humanize } from '@/features/ux-kit/labels';
import { scopeBase, type AnalyticsScope } from './analytics-scope';

/** Loss kinds whose lines can explain no event; quality lines without one are lot dispositions (their own drill). */
const EVENTLESS_KINDS: Readonly<Record<string, string[]>> = {
  all: ['availability', 'performance'],
  availability: ['availability'],
  performance: ['performance'],
};

/**
 * The server query of the loss lines with no event behind the Loss events drill (QA PLA M3 re-test), plan
 * ledger like the attributed losses; null for quality (dispositions, opened from their own link).
 */
export function linesWithoutEventQuery(scope: AnalyticsScope): LinesWithoutEventQuery | null {
  const kinds = EVENTLESS_KINDS[scope.eventOee];
  return kinds ? { ...scopeBase(scope), ledger: 'plan', kinds } : null;
}

/** What a line rests on, in words: the editor's reason, the comment and the cited record ("Log: shift log"). */
export function lineEvidenceText(line: Pick<LineWithoutEventView, 'reason' | 'comment' | 'evidenceType' | 'evidenceRef' | 'origin'>): string {
  const record = line.evidenceType ? [humanize(line.evidenceType), line.evidenceRef].filter(Boolean).join(': ') : line.evidenceRef;
  const parts = [line.reason, line.comment, record].filter((part): part is string => Boolean(part && part.trim()));
  if (parts.length > 0) return [...new Set(parts)].join(' · ');
  return line.origin === 'run' ? 'Calculated line without a cause event' : 'No evidence recorded';
}
