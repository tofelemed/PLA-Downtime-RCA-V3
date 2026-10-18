import { useRestatement } from '@/api/v2/queries/restatement';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { POSTING_TREATMENT_LABELS } from '@/features/plan-dashboard/model/restatement-labels';
import { PostingForm } from '@/features/plan-dashboard/restatement/posting-form';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import type { InlineFormProps } from './inline-form-props';
import { useDecidedWhen } from './use-decided-when';

/**
 * Finance's posting decision of an approved restatement on the approval page: the operational date the
 * figures describe, then the workspace's posting date + treatment form (finance approvers; the delta is in
 * "What changes" above).
 */
export function RestatementPostingDecision({ item, onDecided }: InlineFormProps) {
  const { canDecidePosting } = useCapabilities();
  const pref = useCalendarPreference();
  const query = useRestatement(item.target.periodId, item.target.revision);
  const data = query.data;
  useDecidedWhen(data ? data.posting === null : undefined, 'Posting saved', onDecided);
  if (!canDecidePosting) return <p className="text-sm">Restatement postings are decided by a finance approver.</p>;
  return (
    <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
      {data && (
        <div className="space-y-3" data-testid="inline-restatement-posting">
          <p className="text-sm">
            Restates approved revision {data.supersededRevision}
            {data.afterClose ? ' — correction after month close' : ''} · operational date {formatOperationalDate(data.operationalEffectiveDate, pref)}
            {data.posting ? ` · posted on ${formatOperationalDate(data.posting.postingDate, pref)} as ${POSTING_TREATMENT_LABELS[data.posting.treatment]}` : ''}
          </p>
          <PostingForm data={data} />
        </div>
      )}
    </DataState>
  );
}
