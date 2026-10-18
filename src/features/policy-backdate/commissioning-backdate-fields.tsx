import { Textarea } from '@/components/ui/textarea';
import { DateTimeInput } from '@/features/ux-kit/date-inputs/date-time-input';
import { FormField } from '@/features/ux-kit/form-field';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import type { BackdateDraft, BackdateErrors } from './backdate-model';

export interface CommissioningBackdateFieldsProps {
  /** prefix of the control ids, unique on the page */
  idPrefix: string;
  value: BackdateDraft;
  onChange: (next: BackdateDraft) => void;
  errors: BackdateErrors;
  /** 'approval' = maker-checker: the instant applies once approved and is checked again then */
  takesEffect: 'approval' | 'record';
  /** replaces the standard explanation when the policy's rule differs (valuation: approved figures) */
  explanation?: string;
  disabled?: boolean;
}

const EXPLANATION = {
  approval:
    'Only while commissioning: the version takes effect from this past instant instead of its approval, if no figures of the unit (or of any unit, for a plant-wide version) were calculated from then on. The check is repeated when it is approved.',
  record:
    'Only while commissioning: the version takes effect from this past instant instead of now, if no figures of the unit (or of any unit, for a plant-wide version) were calculated from then on.',
} as const;

/**
 * Collapsed "Commissioning" disclosure of a policy form: an optional past effective-from (plant clock) and
 * the reason for backdating. Empty = the version takes effect as usual; the server has the final word.
 */
export function CommissioningBackdateFields({ idPrefix, value, onChange, errors, takesEffect, explanation, disabled }: CommissioningBackdateFieldsProps) {
  const { timezone } = usePlantTimezone();
  const reasonId = `${idPrefix}-backdate-reason`;
  return (
    <details className="rounded-md border p-3 text-sm" data-testid={`${idPrefix}-commissioning`} open={value.effectiveFrom !== null || undefined}>
      <summary className="cursor-pointer font-medium">Commissioning</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">{explanation ?? EXPLANATION[takesEffect]}</p>
        <DateTimeInput
          label="Effective from (commissioning only)"
          value={value.effectiveFrom}
          timeZone={timezone}
          onChange={(effectiveFrom) => onChange({ ...value, effectiveFrom })}
          disabled={disabled}
          error={errors.effectiveFrom}
        />
        <FormField id={reasonId} label="Reason for backdating" error={errors.reason} required={value.effectiveFrom !== null} hint="Kept with the version and in the audit trail.">
          <Textarea id={reasonId} rows={2} maxLength={1000} value={value.reason} disabled={disabled} onChange={(e) => onChange({ ...value, reason: e.target.value })} />
        </FormField>
      </div>
    </details>
  );
}
