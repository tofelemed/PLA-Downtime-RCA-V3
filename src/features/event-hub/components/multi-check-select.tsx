import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UiIcon } from '@/lib/icons';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

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
  /**
   * true: ticks are collected while the list is open and sent once when it closes (one request per
   * choice instead of one per tick); default false sends every tick.
   */
  commitOnClose?: boolean;
}

const sameSelection = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((value) => b.includes(value));

/** QA L19: the chosen names when one or two are chosen ("Shifts: A"), else the count. */
function selectionSummary(current: readonly string[], options: readonly CheckOption[], number: (value: number) => string): string {
  if (current.length === 0) return 'All';
  if (current.length > 2) return `${number(current.length)} selected`;
  return current.map((value) => options.find((option) => option.value === value)?.label ?? value).join(', ');
}

/** Multi-value filter (OR within one dimension, server-side); keyboard reachable checkboxes. */
export function MultiCheckSelect({ label, options, selected, onChange, testId, commitOnClose = false }: MultiCheckSelectProps) {
  const { number } = useNumberFormat();
  const [draft, setDraft] = useState<readonly string[] | null>(null);
  const current = draft ?? selected;
  const emit = (next: string[]) => (commitOnClose ? setDraft(next) : onChange(next));
  const toggle = (value: string, checked: boolean) => emit(checked ? [...current, value] : current.filter((entry) => entry !== value));
  const onOpenChange = (open: boolean) => {
    if (open || draft === null) return;
    if (!sameSelection(draft, selected)) onChange([...draft]);
    setDraft(null);
  };
  const summary = selectionSummary(current, options, number);
  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid={testId} aria-label={`${label}: ${summary}`}>
          {label}: {summary}
          <UiIcon.expand className="ml-1 h-3 w-3" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-80 w-72 overflow-y-auto p-2" align="start">
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
                <Checkbox id={id} checked={current.includes(option.value)} onCheckedChange={(checked) => toggle(option.value, checked === true)} />
                {option.label}
              </label>
            );
          })}
          {current.length > 0 && (
            <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => emit([])}>
              Clear
            </Button>
          )}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
