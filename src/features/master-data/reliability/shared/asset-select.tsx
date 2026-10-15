import { Label } from '@/components/ui/label';
import { SELECT_CLASS, useAssetLookup } from './use-asset-lookup';

export interface AssetSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (assetId: string) => void;
  /** a first "Every asset" choice that emits '' (list filters) */
  allowAll?: boolean;
}

/** The plant's active assets as a labelled select. */
export function AssetSelect({ id, label, value, onChange, allowAll }: AssetSelectProps) {
  const { assets, isLoading } = useAssetLookup();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allowAll ? 'Every asset' : isLoading ? 'Loading assets…' : 'Choose an asset'}</option>
        {assets.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
      </select>
    </div>
  );
}
