import type { FormEvent } from 'react';
import { ActingPlantField } from '../components/acting-plant-field';
import { FormActions } from '../components/form-actions';
import { LegacyValues } from '../components/legacy-values';
import { TextField } from '../components/text-field';
import type { FieldErrors } from '../model/field-errors';
import type { UnitDraft } from './unit-form-model';
import { SiteSelect } from './site-select';

export interface UnitFormProps {
  draft: UnitDraft;
  errors: FieldErrors;
  onChange: (patch: Partial<UnitDraft>) => void;
  onSave: () => void;
  saving: boolean;
  /** the draft has unsaved edits */
  dirty?: boolean;
  isNew: boolean;
  /** read-only users and retired units: fields are shown, not editable */
  readOnly: boolean;
}

/** Plant (the selected one), name, code, site, description, unit of measure and the folded legacy values. */
export function UnitForm({ draft, errors, onChange, onSave, saving, dirty, isNew, readOnly }: UnitFormProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave();
  };
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4" noValidate aria-label={isNew ? 'Create production unit' : 'Edit production unit'}>
      {/* sites belong to the plant: a switch clears the chosen one */}
      <ActingPlantField editable={isNew && !readOnly} onSwitched={() => onChange({ siteId: '' })} />
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
      <SiteSelect value={draft.siteId} onChange={(siteId) => onChange({ siteId })} disabled={readOnly} />
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
      {!readOnly && <FormActions isNew={isNew} saving={saving} dirty={dirty} cancelTo="/master-data/units" />}
    </form>
  );
}
