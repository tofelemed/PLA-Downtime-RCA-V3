import { Checkbox } from '@/components/ui/checkbox';

export interface PossibleDuplicateToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * DT-04: list only stops that overlap another stop of the same asset — usually one stop entered twice
 * (e.g. manually and from PI); the user merges or retracts the extra one.
 */
export function PossibleDuplicateToggle({ checked, onChange }: PossibleDuplicateToggleProps) {
  return (
    <label
      className="flex items-center gap-2 text-sm"
      htmlFor="filter-possible-duplicates"
      title="Stops that overlap another stop of the same asset (or of the unit when neither has an asset)"
    >
      <Checkbox
        id="filter-possible-duplicates"
        data-testid="filter-possible-duplicates"
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      Possible duplicate stops only
    </label>
  );
}
