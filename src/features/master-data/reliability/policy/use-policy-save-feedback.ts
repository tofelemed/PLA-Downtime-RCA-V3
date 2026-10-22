import { useCapabilities } from '@/features/auth/use-capabilities';
import { useSaveFeedback, type SaveFeedback } from '@/features/ux-kit/save-result';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { policySaveResult, type RecordedPolicyVersion } from './policy-save-result';

export interface PolicySaveFeedback {
  feedback: SaveFeedback;
  /** runs the record command; success → result dialog, failure → `feedback.failure` (rethrown) */
  record: <T extends RecordedPolicyVersion>(work: () => Promise<T>) => Promise<T>;
}

/**
 * Save feedback of one policy section. Call it above the form that is keyed by the version in force: the
 * new version remounts that form with the saved values, and the result dialog must outlive it.
 */
export function usePolicySaveFeedback(what: string, unitId: string, format: Pick<ReliabilityFormat, 'dateTime'>): PolicySaveFeedback {
  const feedback = useSaveFeedback();
  const capabilities = useCapabilities();
  const record = <T extends RecordedPolicyVersion>(work: () => Promise<T>) =>
    feedback.run(work, (saved: T) => policySaveResult({ what, saved, unitId, dateTime: format.dateTime, capabilities }));
  return { feedback, record };
}
