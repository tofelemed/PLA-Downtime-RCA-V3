import { FormField } from '@/features/ux-kit/form-field';
import { useAssetOptions } from '../hooks/use-asset-options';
import type { EventFormState } from '../hooks/use-event-form';

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const NO_UNITS: readonly string[] = [];

/**
 * A-1: the asset that stopped, one of the event unit's assets (the asset directory, retired ones marked).
 * Whether a source-delivered asset may be replaced is the server's override rule; it answers on save.
 */
export function AssetField({ form }: { form: Pick<EventFormState, 'values' | 'errors' | 'setField'> }) {
  const { values, errors, setField } = form;
  const unitIds = values.unitId ? [values.unitId] : NO_UNITS;
  const assets = useAssetOptions(unitIds);
  const noUnit = !values.unitId;
  return (
    <FormField id="assetId" label="Asset" error={errors.assetId} errorTestId="error-assetId" hint={noUnit ? 'Choose the unit first' : 'Equipment of this unit that stopped'}>
      <select id="assetId" className={SELECT_CLASS} value={values.assetId} disabled={noUnit} onChange={(e) => setField('assetId', e.target.value)}>
        <option value="">— not recorded —</option>
        {assets.map((asset) => (
          <option key={asset.value} value={asset.value}>
            {asset.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
