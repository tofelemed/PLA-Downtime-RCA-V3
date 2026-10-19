import type { RestatementView } from '@/api/v2/types/restatement';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { POSTING_TREATMENT_LABELS } from '../model/restatement-labels';

/**
 * Finance's posting decision as text: date, treatment, and who decided it when. A decided posting is final
 * (owner decision 2026-10-19, server 409 POSTING_DECIDED); it is corrected through a new restatement.
 */
export function PostingDecisionText({ data }: { data: RestatementView }) {
  const pref = useCalendarPreference();
  const { timezone } = usePlantTimezone();
  const posting = data.posting;
  if (!posting) return <>posting not decided by finance yet</>;
  return (
    <span data-testid="posting-decided">
      posted on {formatOperationalDate(posting.postingDate, pref)} as {POSTING_TREATMENT_LABELS[posting.treatment]} · decided by {posting.decidedByName ?? 'a former user'} on{' '}
      <PlantTime iso={posting.decidedAt} tz={timezone} withDate />
      {posting.note ? ` · ${posting.note}` : ''}
    </span>
  );
}
