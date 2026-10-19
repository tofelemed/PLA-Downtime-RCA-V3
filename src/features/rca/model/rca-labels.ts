import { RCA_STATUSES, type RcaActionView, type RcaLinkType, type RcaRecommendationView } from '@/api/v2/types/rca';
import type { DigitSystem } from '@/lib/dates';
import { labelOf } from '@/features/ux-kit/labels';
import { capitalizedNoun, eventNoun, PHYSICAL_TYPE_LABELS } from '@/features/ux-kit/labels/event-labels';
import { RCA_VERDICT_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { TRIGGER_LABELS, triggerDetailText } from './trigger-detail';

/** Glossary noun of a linked event's kind (QA L1): a downtime event is a "Stop"; other kinds keep their label. */
export function linkedEventKind(physicalType: unknown): string {
  if (typeof physicalType !== 'string') return 'Event';
  return physicalType === 'downtime' ? capitalizedNoun(eventNoun(physicalType)) : labelOf(PHYSICAL_TYPE_LABELS, physicalType);
}

export const LINK_TYPE_LABELS: Readonly<Record<RcaLinkType, string>> = {
  event: 'Event',
  loss_line: 'Approved loss line',
  work_order: 'Work order',
  occurrence: 'Occurrence',
};

/**
 * Case statuses in sentence case like the rest of the app (QA L2; the stored values stay Title Case);
 * `Published` is a v1 status read as an analysis-stage case.
 */
const STATUS_LABELS: Readonly<Record<string, string>> = {
  'In Progress': 'In progress',
  'Closure Review': 'Closure review',
  Published: 'Published (older investigation)',
};

/** Statuses the list filter offers: `Published` is a legacy v1 value no current investigation holds (QA L2). */
export const FILTER_STATUSES = RCA_STATUSES.filter((status) => status !== 'Published');

export const statusLabel = (status: string | null): string => (status ? STATUS_LABELS[status] ?? status : 'Draft');

const VERIFICATION_LABELS: Readonly<Record<RcaActionView['verificationStatus'], string>> = {
  not_planned: 'No verification planned',
  pending: 'Verification window open',
  due: 'Verification due',
  evaluated: 'Verdict recorded',
};

/**
 * Badge of an action's verification (QA M2): an evaluated action shows its verdict ("Effective", "Not enough
 * evidence yet", …) — never "Verified", which would read as effective whatever the verdict says.
 */
export function verificationLabel(action: Pick<RcaActionView, 'verificationStatus' | 'verdict'>): string {
  if (action.verificationStatus === 'evaluated' && action.verdict) return RCA_VERDICT_LABELS[action.verdict] ?? VERIFICATION_LABELS.evaluated;
  return VERIFICATION_LABELS[action.verificationStatus];
}

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
  if (rec.outcome === 'linked_to_case') parts.push('added to the open investigation about the same problem');
  return parts.join(' · ');
}

/** Readable name of an RCA trigger rule from the recommendation detail, when the rule fired. */
export function ruleNameOf(rec: RcaRecommendationView): string | null {
  const name = rec.detail.ruleName;
  return typeof name === 'string' ? name : null;
}

/** "3/5 done · 1 overdue" of a case's actions (cancelled ones are not counted by the server). */
export function actionProgressText(
  counts: { total: number; done: number; overdue: number },
  number: (value: number) => string = String,
): string {
  const done = `${number(counts.done)}/${number(counts.total)} done`;
  return counts.overdue > 0 ? `${done} · ${number(counts.overdue)} overdue` : done;
}

/**
 * Where the thresholds come from (QA L11): they were frozen from the policy in force when the verification
 * was planned, which may differ from the policy in force now.
 */
export const criteriaSourceText = (policyVersion: number | undefined): string =>
  policyVersion === undefined
    ? 'Thresholds frozen from the RCA policy in force when the verification was planned.'
    : `Thresholds frozen from RCA policy v${policyVersion} when the verification was planned.`;
