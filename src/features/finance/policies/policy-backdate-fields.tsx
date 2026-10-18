import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { BackdateDraft } from '@/features/policy-backdate/backdate-model';
import { BackdateOverlapList } from '@/features/policy-backdate/backdate-overlap-list';
import { CommissioningBackdateFields } from '@/features/policy-backdate/commissioning-backdate-fields';
import type { FieldErrors } from '../model/field-errors';

const EXPLANATION =
  'Only while commissioning: the version values losses from this past instant instead of its start above. It is refused while approved figures of the plant lie in the range, unless you choose to restate them below; the check is repeated when it is approved.';

export interface PolicyBackdateFieldsProps {
  backdate: BackdateDraft;
  restateApproved: boolean;
  onBackdate: (next: BackdateDraft) => void;
  onRestate: (next: boolean) => void;
  errors: FieldErrors;
  /** the last refusal of the save, for the periods a 409 names */
  saveError: unknown;
}

/**
 * Collapsed "Commissioning" disclosure of the valuation policy form (owner, 18 Oct 2026): a past start with
 * its reason, and the choice to revalue approved figures in range through change proposals (approved
 * snapshots are never rewritten). The server decides; the periods of a refusal are listed.
 */
export function PolicyBackdateFields({ backdate, restateApproved, onBackdate, onRestate, errors, saveError }: PolicyBackdateFieldsProps) {
  return (
    <div className="space-y-2">
      <CommissioningBackdateFields
        idPrefix="valuation-policy"
        value={backdate}
        onChange={onBackdate}
        errors={{ effectiveFrom: errors.backdateEffectiveFrom, reason: errors.backdateReason }}
        takesEffect="approval"
        explanation={EXPLANATION}
      />
      {backdate.effectiveFrom !== null && (
        <div className="flex items-start gap-2 text-sm">
          <Checkbox id="valuation-policy-restate" checked={restateApproved} onCheckedChange={(on) => onRestate(on === true)} />
          <Label htmlFor="valuation-policy-restate" className="font-normal leading-snug">
            Restate approved figures in this range: on approval each approved period gets a change proposal for a manager to decide. Approved snapshots stay as they are.
          </Label>
        </div>
      )}
      <BackdateOverlapList error={saveError} />
    </div>
  );
}
