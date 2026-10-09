import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface CheckOption {
  value: string;
  label: string;
  /** indentation level (code trees) */
  level?: number;
}

export interface MultiCheckSelectProps {
  label: string;
  options: readonly CheckOption[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  testId?: string;
}

/** Multi-value filter (OR within one dimension, server-side); keyboard reachable checkboxes. */
export function MultiCheckSelect({ label, options, selected, onChange, testId }: MultiCheckSelectProps) {
  const toggle = (value: string, checked: boolean) =>
    onChange(checked ? [...selected, value] : selected.filter((entry) => entry !== value));
  const summary = selected.length === 0 ? 'All' : `${selected.length} selected`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid={testId} aria-label={`${label}: ${summary}`}>
          {label}: {summary}
          <ChevronDown className="ml-1 h-3 w-3" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 max-h-80 overflow-y-auto p-2" align="start">
        <fieldset>
          <legend className="sr-only">{label}</legend>
          {options.length === 0 && <p className="p-2 text-sm text-muted-foreground">Nothing to choose</p>}
          {options.map((option) => {
            const id = `${testId ?? label}-${option.value}`;
            return (
              <label
                key={option.value}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                style={{ paddingLeft: `${0.5 + (option.level ?? 0) * 0.75}rem` }}
              >
                <Checkbox
                  id={id}
                  checked={selected.includes(option.value)}
                  onCheckedChange={(checked) => toggle(option.value, checked === true)}
                />
                {option.label}
              </label>
            );
          })}
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => onChange([])}>
              Clear
            </Button>
          )}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
