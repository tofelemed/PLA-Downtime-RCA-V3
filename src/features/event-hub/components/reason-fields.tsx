import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { EventFormState } from '../hooks/use-event-form';
import { ReasonCodeSelect } from './reason-code-select';

/**
 * The reason code (the main task of coding a stop, so a downtime form shows it first, E-3) and, for
 * stops, SME D12 "Investigation pending" (no specific reason known yet).
 */
export function ReasonFields({ form }: { form: Pick<EventFormState, 'values' | 'errors' | 'setField'> }) {
  const { values, errors, setField } = form;
  return (
    <div className="space-y-2 sm:col-span-2" data-testid="reason-fields">
      <ReasonCodeSelect id="reasonCodeId" value={values.reasonCodeId} onChange={(value) => setField('reasonCodeId', value)} error={errors.reasonCodeId} />
      {values.physicalType === 'downtime' && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="investigationPending"
            data-testid="form-investigation-pending"
            checked={values.investigationPending}
            onCheckedChange={(value) => setField('investigationPending', value === true)}
          />
          <Label htmlFor="investigationPending" className="font-normal">
            Investigation pending (no specific reason known yet)
          </Label>
        </div>
      )}
    </div>
  );
}
