import { useState } from 'react';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import type { RecordedPolicyVersion } from './policy-save-result';
import { usePolicySaveFeedback, type PolicySaveFeedback } from './use-policy-save-feedback';

export interface PolicyEditor {
  /** the section's save feedback; a recorded version also closes the editor */
  saving: PolicySaveFeedback;
  isOpen: boolean;
  /** opening or closing drops a refusal left from the last attempt */
  setOpen: (open: boolean) => void;
}

/**
 * One policy section's editor panel and save feedback: success closes the panel and shows the result dialog
 * (which outlives the panel); a refusal keeps the panel open with the red alert and the input.
 */
export function usePolicyEditor(what: string, unitId: string, format: Pick<ReliabilityFormat, 'dateTime'>): PolicyEditor {
  const base = usePolicySaveFeedback(what, unitId, format);
  const [isOpen, setIsOpen] = useState(false);
  const setOpen = (open: boolean) => {
    base.feedback.clearFailure();
    setIsOpen(open);
  };
  const record = async <T extends RecordedPolicyVersion>(work: () => Promise<T>): Promise<T> => {
    const saved = await base.record(work);
    setIsOpen(false);
    return saved;
  };
  return { saving: { feedback: base.feedback, record }, isOpen, setOpen };
}
