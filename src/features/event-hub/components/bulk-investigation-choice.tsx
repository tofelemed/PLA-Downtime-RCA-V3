import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import type { InvestigationChoice } from '../hooks/use-bulk-code-flow';

const CHOICES: readonly { value: InvestigationChoice; label: string }[] = [
  { value: 'unchanged', label: 'Leave unchanged' },
  { value: 'set', label: 'Mark investigation pending' },
  { value: 'clear', label: 'Clear investigation pending' },
];

const isChoice = (value: string): value is InvestigationChoice => CHOICES.some((choice) => choice.value === value);

export interface BulkInvestigationChoiceProps {
  value: InvestigationChoice;
  onChange: (value: InvestigationChoice) => void;
  className?: string;
}

/**
 * SME D12 in bulk coding: a three-way choice, since a checkbox cannot tell "leave as is" from "clear".
 * "Leave unchanged" sends nothing; "Mark" sends true; "Clear" sends false.
 */
export function BulkInvestigationChoice({ value, onChange, className }: BulkInvestigationChoiceProps) {
  return (
    <fieldset className={cn('space-y-2', className)} data-testid="bulk-investigation-pending">
      <legend className="text-sm font-medium leading-none">Investigation pending (no specific reason known yet)</legend>
      <RadioGroup value={value} onValueChange={(next) => isChoice(next) && onChange(next)} className="flex flex-wrap gap-4">
        {CHOICES.map((choice) => (
          <div key={choice.value} className="flex items-center gap-2">
            <RadioGroupItem id={`bulk-investigation-${choice.value}`} value={choice.value} data-testid={`bulk-investigation-${choice.value}`} />
            <Label htmlFor={`bulk-investigation-${choice.value}`} className="font-normal">{choice.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
