import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAssetLookup } from '../shared/use-asset-lookup';
import type { ClassThreshold } from './micro-stop-form-model';

export interface ClassThresholdsEditorProps {
  rows: ClassThreshold[];
  onChange: (rows: ClassThreshold[]) => void;
  error?: string;
}

/** Threshold per asset class (asset type → seconds); 0 = every stop of the class is an event. */
export function ClassThresholdsEditor({ rows, onChange, error }: ClassThresholdsEditorProps) {
  const { assets } = useAssetLookup();
  const types = useMemo(() => [...new Set(assets.flatMap((a) => (a.assetType ? [a.assetType] : [])))].sort(), [assets]);
  const update = (index: number, change: Partial<ClassThreshold>) => onChange(rows.map((r, i) => (i === index ? { ...r, ...change } : r)));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Threshold per asset class</legend>
      <datalist id="asset-class-options">
        {types.map((t) => <option key={t} value={t} />)}
      </datalist>
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2" data-testid="class-threshold">
          <Input className="w-48" list="asset-class-options" aria-label={`Asset class ${i + 1}`} value={row.assetClass} onChange={(e) => update(i, { assetClass: e.target.value })} />
          <Input className="w-28" inputMode="numeric" aria-label={`Seconds for class ${i + 1}`} value={row.seconds} onChange={(e) => update(i, { seconds: e.target.value })} />
          <span className="text-sm text-muted-foreground">s</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(rows.filter((_, j) => j !== i))}>Remove</Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, { assetClass: '', seconds: '' }])}>Add an asset class</Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}
