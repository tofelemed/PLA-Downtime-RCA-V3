import { useState } from 'react';
import { useRecordMicroStopPolicy } from '@/api/v2/queries/reliability-policies';
import type { MicroStopPolicyView } from '@/api/v2/types/reliability';
import { Button } from '@/components/ui/button';
import { BackdateOverlapList } from '@/features/policy-backdate/backdate-overlap-list';
import { backdateBodyOf, backdateErrors, EMPTY_BACKDATE, type BackdateErrors } from '@/features/policy-backdate/backdate-model';
import { CommissioningBackdateFields } from '@/features/policy-backdate/commissioning-backdate-fields';
import { FriendlyErrorAlert, PLANT_WIDE_POLICY_MESSAGES } from '@/features/ux-kit/errors';
import { useToast } from '@/hooks/use-toast';
import { TextField } from '../../components/text-field';
import { ClassThresholdsEditor } from './class-thresholds-editor';
import { microStopBodyOf, microStopDraftOf, microStopErrors, type MicroStopDraft, type MicroStopErrors } from './micro-stop-form-model';

export interface MicroStopFormProps {
  /** '' = the plant-wide version */
  unitId: string;
  current: MicroStopPolicyView | undefined;
}

/** A new approved micro-stop version of the unit or plant, effective now (or a commissioning backdate); every other policy field is kept. */
export function MicroStopForm({ unitId, current }: MicroStopFormProps) {
  const [draft, setDraft] = useState<MicroStopDraft>(() => microStopDraftOf(current));
  const [errors, setErrors] = useState<MicroStopErrors>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [backdate, setBackdate] = useState(EMPTY_BACKDATE);
  const [backdateProblems, setBackdateProblems] = useState<BackdateErrors>({});
  const record = useRecordMicroStopPolicy();
  const { toast } = useToast();
  const set = (change: Partial<MicroStopDraft>) => setDraft((d) => ({ ...d, ...change }));
  const save = async () => {
    const found = microStopErrors(draft);
    const backdateFound = backdateErrors(backdate);
    setErrors(found);
    setBackdateProblems(backdateFound);
    setFailure(null);
    if (Object.keys(found).length > 0 || Object.keys(backdateFound).length > 0) return;
    try {
      const saved = await record.submit({ ...microStopBodyOf(unitId, draft), ...backdateBodyOf(backdate) });
      toast({ title: `Micro-stop settings version ${saved.version} in force` });
    } catch (error: unknown) {
      setFailure(error);
    }
  };
  return (
    <form className="max-w-2xl space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <TextField id="micro-seconds" label="Micro-stop threshold (s)" value={draft.microStopSeconds} onChange={(v) => set({ microStopSeconds: v })} error={errors.microStopSeconds} hint="Shorter stops stay in running time and reduce performance." required />
      <ClassThresholdsEditor rows={draft.classes} onChange={(classes) => set({ classes })} error={errors.classes} />
      <TextField id="micro-trips" label="Trip reason codes" value={draft.tripCodes} onChange={(v) => set({ tripCodes: v })} hint="Comma separated. A process trip is always an availability event, never a micro-stop." multiline />
      <TextField id="micro-notes" label="Notes" value={draft.notes} onChange={(v) => set({ notes: v })} maxLength={1000} />
      <CommissioningBackdateFields idPrefix="micro" value={backdate} onChange={setBackdate} errors={backdateProblems} takesEffect="record" />
      {failure !== null && <FriendlyErrorAlert error={failure} context={PLANT_WIDE_POLICY_MESSAGES} />}
      <BackdateOverlapList error={failure} />
      <Button type="submit" disabled={record.isPending}>{backdate.effectiveFrom ? 'Record new version (backdated)' : 'Record new version (effective now)'}</Button>
    </form>
  );
}
