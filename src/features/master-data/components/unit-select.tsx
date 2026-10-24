import { Label } from '@/components/ui/label';
import { RequiredMarker } from '@/features/ux-kit/form-field';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MasterUnitView } from '../api/master-data-types';
import { UNITS } from '../api/record-resource';
import { useRecordLookup } from '../api/use-record-queries';

const ALL = '__all__';
/** filter rows: the label stacked above an h-9 trigger */
const wrapperClass = (compact?: boolean) => (compact ? 'flex flex-col gap-1.5' : 'space-y-1.5');

export interface UnitSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (unitId: string) => void;
  /** list filters: an "All units" choice that emits '' */
  allowAll?: boolean;
  /** text of that choice (default "All units") */
  allLabel?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** opt-in (filter rows): an h-9 trigger with its label stacked above it */
  compact?: boolean;
  /** opt-in: the width of the trigger, e.g. "w-64" */
  triggerClassName?: string;
}

/** The plant's active units by code (every page followed, nothing cut off), as a labelled select. */
export function UnitSelect({ id, label, value, onChange, allowAll, allLabel = 'All units', error, required, disabled, compact, triggerClassName }: UnitSelectProps) {
  const units = useRecordLookup<MasterUnitView>(UNITS, { status: 'active', sort: 'code' });
  const current = value || (allowAll ? ALL : undefined);
  return (
    <div className={wrapperClass(compact)}>
      <Label htmlFor={id}>
        {label}
        {required && <RequiredMarker />}
      </Label>
      <Select value={current} onValueChange={(next) => onChange(next === ALL ? '' : next)} disabled={disabled}>
        <SelectTrigger id={id} className={cn({ 'h-9': compact }, triggerClassName)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}>
          <SelectValue placeholder={units.isLoading ? 'Loading units…' : 'Choose a unit'} />
        </SelectTrigger>
        <SelectContent>
          {allowAll && <SelectItem value={ALL}>{allLabel}</SelectItem>}
          {units.items.map((unit) => (
            <SelectItem key={unit.id} value={unit.id}>
              {unit.code} — {unit.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
