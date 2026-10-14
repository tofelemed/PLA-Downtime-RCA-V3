import { Label } from '@/components/ui/label';
import { useAssetOptions } from '../hooks/use-asset-options';
import type { EventFormField, EventFormValues, FieldErrors } from '../model/event-form';
import { useEventHubEnv } from '../use-event-hub-env';

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

interface OriginForm {
  values: EventFormValues;
  errors: FieldErrors;
  setField: (field: EventFormField, value: string) => void;
}

function FieldError({ id, error }: { id: string; error: string | undefined }) {
  return error ? <p id={`${id}-error`} className="text-xs text-destructive">{error}</p> : null;
}

/**
 * SME D3: which unit or asset caused the stop — e.g. the extruder starved by a reactor trip. The stop stays
 * in this unit's availability (code it external); the origin links the cause. Downtime only.
 */
export function OriginFields({ form }: { form: OriginForm }) {
  const { values, errors, setField } = form;
  const env = useEventHubEnv();
  const assets = useAssetOptions(values.originUnitId ? [values.originUnitId] : []);
  if (values.physicalType !== 'downtime') return null;
  const chooseUnit = (unitId: string) => {
    setField('originUnitId', unitId);
    setField('originAssetId', '');
  };
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="originUnitId">Caused by unit</Label>
        <select id="originUnitId" className={SELECT_CLASS} value={values.originUnitId} onChange={(e) => chooseUnit(e.target.value)}
          aria-invalid={Boolean(errors.originUnitId)} aria-describedby={errors.originUnitId ? 'originUnitId-error' : undefined}>
          <option value="">This unit</option>
          {env.units.filter((unit) => unit.id !== values.unitId).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
        <FieldError id="originUnitId" error={errors.originUnitId} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="originAssetId">Caused by asset</Label>
        <select id="originAssetId" className={SELECT_CLASS} value={values.originAssetId} onChange={(e) => setField('originAssetId', e.target.value)}
          aria-invalid={Boolean(errors.originAssetId)} aria-describedby={errors.originAssetId ? 'originAssetId-error' : undefined}>
          <option value="">— not known —</option>
          {assets.map((asset) => <option key={asset.value} value={asset.value}>{asset.label}</option>)}
        </select>
        <FieldError id="originAssetId" error={errors.originAssetId} />
      </div>
    </>
  );
}
