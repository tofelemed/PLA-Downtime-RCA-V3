import type { ProductionEventView } from '@/api/v2/types/events';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/features/ux-kit/form-field';
import type { EventFormState } from '../hooks/use-event-form';
import { useFormReasonSplit } from '../hooks/use-form-reason-split';
import { ReasonChoice } from './reason-choice';
import { ReasonCodeSelect } from './reason-code-select';

const NOTE_MAX = 1000;

export interface ReasonFieldsProps {
  form: Pick<EventFormState, 'values' | 'errors' | 'setField'>;
  /** edit: the stored event (a split across several reasons is offered on edit only) */
  event?: ProductionEventView | null;
}

/**
 * The reason code (the main task of coding a stop, so a downtime form shows it first, E-3) — on edit, for
 * the roles that may, a split across several reasons (D-T5) — the coding note in the coder's own words
 * beside the code, and, for stops, SME D12 "Investigation pending" (no specific reason known yet).
 */
export function ReasonFields({ form, event = null }: ReasonFieldsProps) {
  const { values, errors, setField } = form;
  const split = useFormReasonSplit(form, event);
  return (
    <div className="space-y-2 sm:col-span-2" data-testid="reason-fields">
      {event ? (
        <ReasonChoice event={event} split={split} reasonCodeId={values.reasonCodeId} onReason={(value) => setField('reasonCodeId', value)} selectId="reasonCodeId" error={errors.reasonCodeId} allowEmpty />
      ) : (
        <ReasonCodeSelect id="reasonCodeId" value={values.reasonCodeId} onChange={(value) => setField('reasonCodeId', value)} error={errors.reasonCodeId} />
      )}
      {errors.splitRows && (
        <p className="text-sm text-destructive" role="alert" data-testid="error-splitRows">{errors.splitRows}</p>
      )}
      <FormField id="codingNote" label="Coding note (optional, in your own words)" error={errors.codingNote} errorTestId="error-codingNote" hint="What happened, for the reader and the investigation; the reason code stays the attribution">
        <Textarea id="codingNote" data-testid="form-coding-note" value={values.codingNote} maxLength={NOTE_MAX} rows={2} onChange={(e) => setField('codingNote', e.target.value)} />
      </FormField>
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
