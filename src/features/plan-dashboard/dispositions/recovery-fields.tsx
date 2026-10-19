import { Label } from '@/components/ui/label';
import { useLotDispositions } from '@/api/v2/queries/lot-dispositions';
import { DISPOSITION_CLASS_LABELS, RECOVERABLE_CLASSES } from '@/features/ux-kit/disposition-labels';
import { RequiredMarker } from '@/features/ux-kit/form-field';
import { labelOf } from '@/features/ux-kit/labels';
import type { DispositionFormValues } from '../model/disposition-form';

const SELECT = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

export interface RecoveryFieldsProps {
  unitId: string;
  /** dispositions produced before this instant can be recovered */
  before: string;
  values: DispositionFormValues;
  error?: string;
  set: <K extends keyof DispositionFormValues>(key: K, value: DispositionFormValues[K]) => void;
}

/**
 * SME E3 recovery movement: which approved downgrade, transition off-grade or rework the reprocessed
 * material comes from, and whether it passed this unit's meter again (then it is no new output).
 */
export function RecoveryFields({ unitId, before, values, error, set }: RecoveryFieldsProps) {
  const sources = useLotDispositions({ unitId, to: before, state: 'approved' });
  const options = (sources.data?.items ?? []).filter((d) => RECOVERABLE_CLASSES.includes(d.dispositionClass));
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="dispRecoveryOf">
          Recovers
          <RequiredMarker />
        </Label>
        <select id="dispRecoveryOf" required className={SELECT} value={values.recoveryOfId} onChange={(e) => set('recoveryOfId', e.target.value)}>
          <option value="">— choose the original disposition —</option>
          {options.map((d) => (
            <option key={d.id} value={d.id}>{`${d.lotCode} · ${labelOf(DISPOSITION_CLASS_LABELS, d.dispositionClass)} · ${d.quantity} ${d.uom}`}</option>
          ))}
        </select>
        {error && <p className="text-xs text-destructive" data-testid="field-error-dispRecoveryOf">{error}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm" htmlFor="dispRemeasured">
        <input id="dispRemeasured" type="checkbox" checked={values.remeasured} onChange={(e) => set('remeasured', e.target.checked)} />
        Reprocessed through this unit&apos;s production meter (not new output)
      </label>
    </>
  );
}
