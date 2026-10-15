import type { PostingTreatment } from '@/api/v2/types/restatement';

/** Names of the figures a restatement compares. */
export const RESTATEMENT_FIGURE_LABELS: Record<string, string> = {
  target: 'Target',
  actual: 'Actual',
  gap: 'Gap',
  attributed: 'Attributed',
  toleranceAdjustment: 'Tolerance adjustment',
  residual: 'Residual',
  gross: 'Gross production',
  good: 'Good production',
  reject: 'Rejected',
};

/** How finance treats a restatement (SME R5; IAS 8 separates corrections from changes in estimates). */
export const POSTING_TREATMENT_LABELS: Record<PostingTreatment, string> = {
  correction: 'a correction',
  estimate_change: 'a change in estimate',
  other_adjustment: 'another adjustment',
  no_posting: 'no posting',
};
