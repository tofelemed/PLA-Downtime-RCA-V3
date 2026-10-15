import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { NativeSelect } from '../components/native-select';
import { Field } from '../components/field';
import { SOURCE_CLASS_OPTIONS, SOURCE_OPTIONS, type EntryValues } from './hierarchy-form';

export interface HierarchyEntryFieldsProps {
  index: number;
  count: number;
  entry: EntryValues;
  error?: string;
  onChange: (next: EntryValues) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}

function CrossBoundary({ index, entry, set }: { index: number; entry: EntryValues; set: (next: Partial<EntryValues>) => void }) {
  return (
    <div className="grid gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-3">
      <label className="flex items-center gap-1 text-sm sm:col-span-3">
        <Checkbox checked={entry.inventoryChangeAccounted} onCheckedChange={(c) => set({ inventoryChangeAccounted: c === true })} data-testid={`authority-entry-stock-${index}`} />
        The record already includes the stock change between the boundaries (otherwise it is never a substitute)
      </label>
      <Field id={`authority-entry-lag-${index}`} label="Lag (seconds)" hint="Signal sources only">
        <Input id={`authority-entry-lag-${index}`} inputMode="numeric" value={entry.lagSeconds} onChange={(e) => set({ lagSeconds: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Field id={`authority-entry-evidence-${index}`} label="Evidence">
          <Input id={`authority-entry-evidence-${index}`} maxLength={500} value={entry.evidenceRef} onChange={(e) => set({ evidenceRef: e.target.value })} data-testid={`authority-entry-evidence-${index}`} />
        </Field>
      </div>
    </div>
  );
}

/** One ranked source of the hierarchy: class, source, optional signal, its boundary and how it is adjusted. */
export function HierarchyEntryFields({ index, count, entry, error, onChange, onMove, onRemove }: HierarchyEntryFieldsProps) {
  const set = (next: Partial<EntryValues>) => onChange({ ...entry, ...next });
  const format = useNumberFormat();
  return (
    <fieldset className="space-y-2 rounded-md border p-2" data-testid="authority-entry">
      <legend className="px-1 text-sm font-medium">Rank {format.number(index + 1)}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field id={`authority-entry-class-${index}`} label="Kind">
          <NativeSelect id={`authority-entry-class-${index}`} value={entry.sourceClass} onChange={(v) => set({ sourceClass: v })} options={SOURCE_CLASS_OPTIONS} />
        </Field>
        <Field id={`authority-entry-source-${index}`} label="Source">
          <NativeSelect id={`authority-entry-source-${index}`} value={entry.source} onChange={(v) => set({ source: v })} options={SOURCE_OPTIONS} />
        </Field>
        <Field id={`authority-entry-signal-${index}`} label="Signal (optional)" hint="Tag or topic of the one signal this rank reads">
          <Input id={`authority-entry-signal-${index}`} maxLength={500} value={entry.signalSourceKey} onChange={(e) => set({ signalSourceKey: e.target.value })} data-testid={`authority-entry-signal-${index}`} />
        </Field>
        <Field id={`authority-entry-boundary-${index}`} label="Boundary of this source" error={error}>
          <Input id={`authority-entry-boundary-${index}`} value={entry.boundary} onChange={(e) => set({ boundary: e.target.value })} />
        </Field>
      </div>
      <label className="flex items-center gap-1 text-sm">
        <Checkbox checked={entry.crossBoundary} onCheckedChange={(c) => set({ crossBoundary: c === true })} data-testid={`authority-entry-cross-${index}`} />
        Measured at another boundary (declare how it is brought to the slice boundary)
      </label>
      {entry.crossBoundary && <CrossBoundary index={index} entry={entry} set={set} />}
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => onMove(index - 1)}>
          Move up
        </Button>
        <Button size="sm" variant="ghost" disabled={index === count - 1} onClick={() => onMove(index + 1)}>
          Move down
        </Button>
        <Button size="sm" variant="ghost" disabled={count === 1} onClick={onRemove}>
          Remove
        </Button>
      </div>
    </fieldset>
  );
}
