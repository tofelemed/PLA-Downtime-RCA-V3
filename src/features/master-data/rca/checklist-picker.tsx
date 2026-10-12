import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { VerificationChecklistView } from '../api/master-data-types';
import { VERIFICATION_CHECKLISTS } from '../api/record-resource';
import { useRecordLookup } from '../api/use-record-queries';

export interface ChecklistPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
}

/** The plant's active verification checklists as checkboxes (every page loaded). */
export function ChecklistPicker({ value, onChange, disabled }: ChecklistPickerProps) {
  const checklists = useRecordLookup<VerificationChecklistView>(VERIFICATION_CHECKLISTS, { status: 'active', sort: 'name' });
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((entry) => entry !== id));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Verification checklists</legend>
      {checklists.isLoading && <p className="text-sm text-muted-foreground">Loading checklists…</p>}
      {!checklists.isLoading && checklists.items.length === 0 && (
        <p className="text-sm text-muted-foreground">No active checklist yet. Add them under Verification checklists.</p>
      )}
      {checklists.items.map((checklist) => (
        <div key={checklist.id} className="flex items-center gap-2">
          <Checkbox
            id={`checklist-${checklist.id}`}
            checked={value.includes(checklist.id)}
            onCheckedChange={(checked) => toggle(checklist.id, checked === true)}
            disabled={disabled}
          />
          <Label htmlFor={`checklist-${checklist.id}`} className="font-normal">
            {checklist.name} <span className="text-muted-foreground">({checklist.items.length} items)</span>
          </Label>
        </div>
      ))}
    </fieldset>
  );
}
