import type { BulkTarget } from '@/api/v2/types/events';
import { FormField } from '@/features/ux-kit/form-field';
import { useAssetOptions } from '../hooks/use-asset-options';
import type { BulkCodes } from '../hooks/use-bulk-code-flow';
import { sharedUnitOf } from '../model/bulk-targets';
import { BulkInvestigationChoice } from './bulk-investigation-choice';

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const NO_UNITS: readonly string[] = [];

export interface BulkExtraFieldsProps {
  events: readonly BulkTarget[];
  codes: Pick<BulkCodes, 'assetId' | 'investigationPending'>;
  edit: <K extends 'assetId' | 'investigationPending'>(key: K, value: BulkCodes[K]) => void;
}

/**
 * A-1 / SME D12 in bulk coding: the asset (equipment of the events' unit — offered only when every chosen
 * event is of one unit, the server refuses others with 422) and "investigation pending" (leave, mark or clear). On source events
 * the asset becomes a recorded override, as with a single edit (server rule).
 */
export function BulkExtraFields({ events, codes, edit }: BulkExtraFieldsProps) {
  const unitId = sharedUnitOf(events);
  const assets = useAssetOptions(unitId ? [unitId] : NO_UNITS);
  const hint = unitId ? 'Equipment of this unit that stopped; on source events recorded as an override' : 'The chosen events belong to several units: code the asset per unit.';
  return (
    <>
      <FormField id="bulk-asset" label="Asset" hint={hint} className="sm:col-span-2">
        <select id="bulk-asset" className={SELECT_CLASS} value={unitId ? codes.assetId : ''} disabled={!unitId} onChange={(e) => edit('assetId', e.target.value)}>
          <option value="">— unchanged —</option>
          {unitId && assets.map((asset) => (
            <option key={asset.value} value={asset.value}>
              {asset.label}
            </option>
          ))}
        </select>
      </FormField>
      <BulkInvestigationChoice value={codes.investigationPending} onChange={(value) => edit('investigationPending', value)} className="sm:col-span-2" />
    </>
  );
}
