import { CASE_REPAIRED_ACTION } from '../database/case-repair-history';

/**
 * The reason of each recorded data repair in the History's words (QA N4), by the repair's name
 * (`detail.repair`). `audit_log` is append-only and applied migrations are never edited, so the stored text
 * stays as written; the History shows these words instead: no "Data repair:" prefix (the entry's title says
 * it) and statuses as the screens name them ("Done").
 */
const REPAIR_REASONS: Readonly<Record<string, string>> = {
  CloseRecommendationsOfClosedCases1794221700000:
    'Recommendations completed after the investigation closed: each recommendation was set to Done or ' +
    'Cancelled from the statuses of its actions (the closure rule, applied to investigations closed before ' +
    'the rule existed)',
};

const PREFIX = /^\s*data repair\s*:\s*/i;

const capitalised = (text: string) =>
  text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text;

/** The reason of a History entry as shown: a data repair's reason in the History's words, else as stored. */
export function historyReason(row: {
  action: string;
  reason: string | null;
  detail: Record<string, unknown>;
}): string | null {
  if (row.action !== CASE_REPAIRED_ACTION) return row.reason;
  const repair = row.detail.repair;
  const known = typeof repair === 'string' ? REPAIR_REASONS[repair] : undefined;
  if (known) return known;
  return row.reason ? capitalised(row.reason.replace(PREFIX, '')) : null;
}
