import type { FormEvent } from 'react';
import { ASSET_CRITICALITY_LABELS, ASSET_STATUS_OPTIONS, ASSET_TYPE_OPTIONS } from '@/features/ux-kit/labels';
import { ActingPlantField } from '../components/acting-plant-field';
import { ChoiceField } from '../components/choice-field';
import { FormActions } from '../components/form-actions';
import { TextField } from '../components/text-field';
import { UnitSelect } from '../components/unit-select';
import type { FieldErrors } from '../model/field-errors';
import type { AssetDraft } from './asset-form-model';

export interface AssetFormProps {
  draft: AssetDraft;
  errors: FieldErrors;
  onChange: (patch: Partial<AssetDraft>) => void;
  onSave: () => void;
  saving: boolean;
  /** the draft has unsaved edits */
  dirty?: boolean;
  isNew: boolean;
  readOnly: boolean;
  /** Cancel's target: the page the asset was opened from (default: the asset list) */
  cancelTo?: string;
}

const TYPE_OPTIONS = ASSET_TYPE_OPTIONS.map((value) => ({ value, label: value }));
const STATUS_OPTIONS = ASSET_STATUS_OPTIONS.map((value) => ({ value, label: value }));
const CRITICALITY_OPTIONS = Object.entries(ASSET_CRITICALITY_LABELS).map(([value, label]) => ({ value, label }));

/** Identity (name, code, unit), classification (type, criticality, status) and the descriptive fields. */
export function AssetForm({ draft, errors, onChange, onSave, saving, dirty, isNew, readOnly, cancelTo = '/master-data/assets' }: AssetFormProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave();
  };
  const text = (id: keyof AssetDraft, label: string, extra: { hint?: string; required?: boolean; multiline?: boolean } = {}) => (
    <TextField id={id} label={label} value={draft[id]} onChange={(value) => onChange({ [id]: value })} error={errors[id]} disabled={readOnly} {...extra} />
  );
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4" noValidate aria-label={isNew ? 'Create asset' : 'Edit asset'}>
      {/* units belong to the plant: a switch clears the chosen one */}
      <ActingPlantField editable={isNew && !readOnly} onSwitched={() => onChange({ unitId: '' })} />
      <div className="grid gap-4 sm:grid-cols-2">
        {text('name', 'Name', { required: true })}
        {text('code', 'Code', { required: true, hint: 'Unique in this plant.' })}
      </div>
      <UnitSelect id="unitId" label="Production unit" value={draft.unitId} onChange={(unitId) => onChange({ unitId })} error={errors.unitId} required disabled={readOnly} />
      {text('description', 'Description', { multiline: true })}
      <div className="grid gap-4 sm:grid-cols-3">
        <ChoiceField id="assetType" label="Asset type" value={draft.assetType} onChange={(assetType) => onChange({ assetType })} options={TYPE_OPTIONS} disabled={readOnly} />
        <ChoiceField id="criticality" label="Criticality" value={draft.criticality} onChange={(criticality) => onChange({ criticality })} options={CRITICALITY_OPTIONS} disabled={readOnly} />
        <ChoiceField id="status" label="Operating status" value={draft.status} onChange={(status) => onChange({ status })} options={STATUS_OPTIONS} disabled={readOnly} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {text('manufacturer', 'Manufacturer')}
        {text('model', 'Model')}
        {text('serialNumber', 'Serial number')}
        {text('location', 'Location')}
      </div>
      {!readOnly && <FormActions isNew={isNew} saving={saving} dirty={dirty} cancelTo={cancelTo} />}
    </form>
  );
}
