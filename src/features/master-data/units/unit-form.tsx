import type { FormEvent } from 'react';
import { FormActions } from '../components/form-actions';
import { LegacyValues } from '../components/legacy-values';
import { TextField } from '../components/text-field';
import type { FieldErrors } from '../model/field-errors';
import type { UnitDraft } from './unit-form-model';

export interface UnitFormProps {
  draft: UnitDraft;
  errors: FieldErrors;
  onChange: (patch: Partial<UnitDraft>) => void;
  onSave: () => void;
  saving: boolean;
  isNew: boolean;
  /** read-only users and retired units: fields are shown, not editable */
  readOnly: boolean;
  plantName: string;
}

/** Name, code, plant (the selected one), description, unit of measure and the folded legacy values. */
export function UnitForm({ draft, errors, onChange, onSave, saving, isNew, readOnly, plantName }: UnitFormProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave();
  };
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4" noValidate aria-label={isNew ? 'Create production unit' : 'Edit production unit'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="name" label="Name" value={draft.name} onChange={(name) => onChange({ name })} error={errors.name} required disabled={readOnly} maxLength={255} />
        <TextField
          id="code"
          label="Code"
          value={draft.code}
          onChange={(code) => onChange({ code })}
          error={errors.code}
          hint="Unique in this plant, e.g. EXT-LINE-3."
          required
          disabled={readOnly}
          maxLength={50}
        />
      </div>
      <p className="text-sm">
        <span className="text-muted-foreground">Plant: </span>
        {plantName}
      </p>
      <TextField id="description" label="Description" value={draft.description} onChange={(description) => onChange({ description })} multiline disabled={readOnly} />
      <TextField
        id="unitOfMeasure"
        label="Unit of measure"
        value={draft.unitOfMeasure}
        onChange={(unitOfMeasure) => onChange({ unitOfMeasure })}
        placeholder="e.g. t"
        disabled={readOnly}
        maxLength={50}
      />
      <LegacyValues>
        <TextField id="capacity" label="Capacity" value={draft.capacity} onChange={(capacity) => onChange({ capacity })} error={errors.capacity} inputMode="decimal" disabled={readOnly} />
        <TextField
          id="idealCycleTime"
          label="Ideal cycle time (seconds per unit)"
          value={draft.idealCycleTimeSeconds}
          onChange={(idealCycleTimeSeconds) => onChange({ idealCycleTimeSeconds })}
          error={errors.idealCycleTimeSeconds}
          inputMode="decimal"
          disabled={readOnly}
        />
      </LegacyValues>
      {!readOnly && <FormActions isNew={isNew} saving={saving} cancelTo="/master-data/units" />}
    </form>
  );
}
