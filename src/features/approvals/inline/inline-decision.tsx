import type { ComponentType } from 'react';
import type { ApprovalItem } from '@/api/v2/types/approvals';
import { DECIDED_LABELS } from '../approval-command';
import { ApprovalDetailActions } from '../approval-detail-actions';
import { ChangeProposalDecision } from './change-proposal-decision';
import type { InlineFormProps } from './inline-form-props';
import { MonthCloseDecision } from './month-close-decision';
import { PeriodReviewDecision } from './period-review-decision';
import { RcaClosureDecision } from './rca-closure-decision';
import { RestatementPostingDecision } from './restatement-posting-decision';
import { SourceStatusDecision } from './source-status-decision';
import { StopMergeDecision } from './stop-merge-decision';
import type { OnDecided } from './use-decided-when';

/** Reviews whose decision is a workflow command of their own, decided here with the workspace's form. */
const FORMS: Readonly<Record<string, ComponentType<InlineFormProps>>> = {
  'period-review': PeriodReviewDecision,
  'finance-posting': RestatementPostingDecision,
  'change-proposal': ChangeProposalDecision,
  'rca-closure': RcaClosureDecision,
  'month-materiality': MonthCloseDecision,
  'month-finance': MonthCloseDecision,
  'month-lock': MonthCloseDecision,
  'stop-merge': StopMergeDecision,
  'source-status': SourceStatusDecision,
};

/**
 * The decision of one pending record, in place: the inbox commands (approve / reject / return / retire /
 * activate) or the review's own workspace form. The server's gates and separation of duties decide.
 */
export function InlineDecision({ item, onDecided }: { item: ApprovalItem; onDecided: OnDecided }) {
  if (item.actions.length > 0) return <ApprovalDetailActions item={item} onDecided={(action) => onDecided(DECIDED_LABELS[action])} />;
  const Form = FORMS[item.kind];
  if (!Form) return <p className="text-sm">This review is decided in its workspace.</p>;
  return <Form item={item} onDecided={onDecided} />;
}
