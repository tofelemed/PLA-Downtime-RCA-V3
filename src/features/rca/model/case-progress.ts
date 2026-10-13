import type { RcaCaseView } from '@/api/v2/types/rca';
import { RCA_STATUSES } from '@/api/v2/types/rca';
import { isRecommendationClosed } from './recommendation-form';

/** One step of the investigation checklist (shown with its state; only closing is gated, by the server). */
export interface ProgressStep {
  key: string;
  label: string;
  done: boolean;
  hint: string;
}

/**
 * The investigation steps of v1's phase stepper (definition → data collection → analysis →
 * recommendations → closure), read from the case content. A guide for the team, not a rule.
 */
export function progressSteps(rca: RcaCaseView, hasToolRecord: boolean): ProgressStep[] {
  const evidence = rca.evidence.length;
  const recommendations = rca.recommendations.length;
  return [
    {
      key: 'definition',
      label: 'Definition',
      done: Boolean(rca.description && rca.teamCharter && rca.teamMemberIds.length > 0),
      hint: 'Problem statement, team charter and at least one team member.',
    },
    { key: 'evidence', label: 'Data collection', done: evidence > 0, hint: `${evidence} evidence item(s).` },
    {
      key: 'analysis',
      label: 'Analysis',
      done: rca.logicTree.length > 0 || hasToolRecord || Boolean(rca.rootCause),
      hint: rca.rootCause ? 'Root cause written down.' : 'Logic tree or an analysis tool, then the root cause.',
    },
    {
      key: 'recommendations',
      label: 'Recommendations',
      done: recommendations > 0,
      hint: `${recommendations} recommendation(s), ${rca.recommendations.filter((r) => isRecommendationClosed(r.status)).length} closed.`,
    },
    { key: 'closure', label: 'Closure', done: rca.status === 'Closed', hint: 'Close once the root cause is written down and every action is done or cancelled.' },
  ];
}

/** Position of the case status in the workflow (Draft = 1 … Closed = 5). */
export function statusStep(status: string | null): number {
  const index = RCA_STATUSES.findIndex((value) => value === status);
  return index < 0 ? 1 : index + 1;
}
