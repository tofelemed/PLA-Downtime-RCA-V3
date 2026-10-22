import { useSaveFeedback, type SaveFeedback } from '@/features/ux-kit/save-result';
import { AdminRefusalAlert } from '../components/admin-refusal-alert';

export interface CodesSaveFeedbackOptions {
  /** false where the field errors are already shown on their rows (the rule builder) */
  withFields?: boolean;
}

/**
 * `useSaveFeedback` for the codes & rules screens: toast or result dialog on success, and on failure
 * `AdminRefusalAlert` in the kit's focusing frame instead of the kit's generic alert — it adds the reference
 * counts of a refused retire (409 CODE_HAS_CHILDREN), the locked icon of a role refusal and the `data-kind` /
 * `data-status` attributes the codes e2e specs read. Render `alert` at the top of the form or inside the
 * confirmation, `dialog` anywhere.
 */
export function useCodesSaveFeedback({ withFields = true }: CodesSaveFeedbackOptions = {}): SaveFeedback {
  return useSaveFeedback(undefined, (failure) => <AdminRefusalAlert error={failure} withFields={withFields} />);
}
