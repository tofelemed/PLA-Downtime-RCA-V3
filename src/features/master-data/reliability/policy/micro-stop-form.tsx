import { useState } from 'react';
import { useRecordMicroStopPolicy } from '@/api/v2/queries/reliability-policies';
import type { MicroStopPolicyView } from '@/api/v2/types/reliability';
import { Button } from '@/components/ui/button';
import { BackdateOverlapList } from '@/features/policy-backdate/backdate-overlap-list';
import { backdateBodyOf, backdateErrors, EMPTY_BACKDATE, type BackdateErrors } from '@/features/policy-backdate/backdate-model';
import { CommissioningBackdateFields } from '@/features/policy-backdate/commissioning-backdate-fields';
import { PLANT_WIDE_POLICY_MESSAGES } from '@/features/ux-kit/errors';
import { SaveFailureAlert } from '@/features/ux-kit/save-result';
import { TextField } from '../../components/text-field';
import { ClassThresholdsEditor } from './class-thresholds-editor';
import { microStopBodyOf, microStopDraftOf, microStopErrors, type MicroStopDraft, type MicroStopErrors } from './micro-stop-form-model';
import type { PolicySaveFeedback } from './use-policy-save-feedback';

export interface MicroStopFormProps {
  /** '' = the plant-wide version */
  unitId: string;
  current: MicroStopPolicyView | undefined;
  /** the section's save feedback: it outlives this form, which the saved version remounts */
  saving: PolicySaveFeedback;
}

/** A new approved micro-stop version of the unit or plant, effective now (or a commissioning backdate); every other policy field is kept. */
export function MicroStopForm({ unitId, current, saving }: MicroStopFormProps) {
  const [draft, setDraft] = useState<MicroStopDraft>(() => microStopDraftOf(current));
  const [errors, setErrors] = useState<MicroStopErrors>({});
  const [backdate, setBackdate] = useState(EMPTY_BACKDATE);
  const [backdateProblems, setBackdateProblems] = useState<BackdateErrors>({});
  const record = useRecordMicroStopPolicy();
  const failure = saving.feedback.failure;
  const set = (change: Partial<MicroStopDraft>) => setDraft((d) => ({ ...d, ...change }));
  const save = async () => {
    const found = microStopErrors(draft);
    const backdateFound = backdateErrors(backdate);
    setErrors(found);
    setBackdateProblems(backdateFound);
    saving.feedback.clearFailure();
    if (Object.keys(found).length > 0 || Object.keys(backdateFound).length > 0) return;
    // a refusal stays in the red alert at the top, with the input kept
    await saving.record(() => record.submit({ ...microStopBodyOf(unitId, draft), ...backdateBodyOf(backdate) })).catch(() => null);
  };
  return (
    <form noValidate className="max-w-2xl space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <SaveFailureAlert error={failure} context={PLANT_WIDE_POLICY_MESSAGES} />
      <BackdateOverlapList error={failure} />
      <TextField id="micro-seconds" label="Micro-stop threshold (s)" value={draft.microStopSeconds} onChange={(v) => set({ microStopSeconds: v })} error={errors.microStopSeconds} hint="Shorter stops stay in running time and reduce performance." required />
      <ClassThresholdsEditor rows={draft.classes} onChange={(classes) => set({ classes })} error={errors.classes} />
      <TextField id="micro-trips" label="Trip reason codes" value={draft.tripCodes} onChange={(v) => set({ tripCodes: v })} hint="Comma separated. A process trip is always an availability event, never a micro-stop." multiline />
      <TextField id="micro-notes" label="Notes" value={draft.notes} onChange={(v) => set({ notes: v })} maxLength={1000} />
      <CommissioningBackdateFields idPrefix="micro" value={backdate} onChange={setBackdate} errors={backdateProblems} takesEffect="record" />
      <Button type="submit" disabled={record.isPending}>{backdate.effectiveFrom ? 'Record new version (backdated)' : 'Record new version (effective now)'}</Button>
    </form>
  );
}
