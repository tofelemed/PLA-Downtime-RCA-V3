import { cn } from '@/lib/utils';

export interface UomPickerProps {
  uoms: readonly string[];
  value: string;
  onChange: (uom: string) => void;
}

/** Unit of measure switch: quantities of different units are never added, so the section shows one unit at a time. Hidden with fewer than two units. */
export function UomPicker({ uoms, value, onChange }: UomPickerProps) {
  if (uoms.length < 2) return null;
  return (
    <div role="group" aria-label="Unit of measure" className="flex items-center gap-1 text-xs" data-testid="plan-uom-picker">
      {uoms.map((uom) => (
        <button
          key={uom}
          type="button"
          aria-pressed={uom === value}
          onClick={() => onChange(uom)}
          className={cn('rounded-full border px-2.5 py-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', uom === value ? 'bg-muted' : 'text-muted-foreground')}
        >
          {uom}
        </button>
      ))}
    </div>
  );
}
