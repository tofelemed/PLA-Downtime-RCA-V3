import type { RcaActionView, RcaLinkType, RcaRecommendationView } from '@/api/v2/types/rca';
import type { DigitSystem } from '@/lib/dates';
import { TRIGGER_LABELS, triggerDetailText } from './trigger-detail';

export const LINK_TYPE_LABELS: Readonly<Record<RcaLinkType, string>> = {
  event: 'Event',
  loss_line: 'Approved loss line',
  work_order: 'Work order',
  occurrence: 'Occurrence',
};

/** Case statuses are words already; `Published` is a v1 status read as an analysis-stage case. */
const STATUS_LABELS: Readonly<Record<string, string>> = {
  Published: 'Published (older case)',
};

export const statusLabel = (status: string | null): string => (status ? STATUS_LABELS[status] ?? status : 'Draft');

const VERIFICATION_LABELS: Readonly<Record<RcaActionView['verificationStatus'], string>> = {
  not_planned: 'No verification planned',
  pending: 'Verification window open',
  due: 'Verification due',
  evaluated: 'Verified',
};

export const verificationLabel = (status: RcaActionView['verificationStatus']) => VERIFICATION_LABELS[status];

/**
 * Badge text of a recommendation with its attribution (RCA02: automation recommends, a person decides):
 * what fired, the policy or rule version, and the provisional marker of a still-open event.
 */
export function recommendationText(rec: RcaRecommendationView): string {
  const what = TRIGGER_LABELS[rec.trigger] ?? rec.trigger;
  const source = rec.source.kind === 'rule' ? `rule v${rec.source.version}` : `RCA policy v${rec.source.version}`;
  return `${what} · ${source}${rec.provisional ? ' · provisional (event still open)' : ''}`;
}

/** What fired in numbers, and whether it was added to an open case about the same problem (CA8). */
export function recommendationDetail(rec: RcaRecommendationView, digits?: DigitSystem): string {
  const parts = triggerDetailText(rec, digits);
  if (rec.outcome === 'linked_to_case') parts.push('added to the open case about the same problem');
  return parts.join(' · ');
}

/** Readable name of an RCA trigger rule from the recommendation detail, when the rule fired. */
export function ruleNameOf(rec: RcaRecommendationView): string | null {
  const name = rec.detail.ruleName;
  return typeof name === 'string' ? name : null;
}
