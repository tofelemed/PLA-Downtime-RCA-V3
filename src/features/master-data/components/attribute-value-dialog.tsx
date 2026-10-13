import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/features/ux-kit/date-inputs';
import type { AttributeDefinitionView as CustomAttributeDefinition } from '@/api/v2/types/administration';

export interface AttributeValueDialogProps {
  definition: CustomAttributeDefinition;
  value: string;
  saving: boolean;
  onSave: (value: string) => Promise<unknown>;
  onClose: () => void;
}

function ValueInput({ definition, value, onChange }: { definition: CustomAttributeDefinition; value: string; onChange: (v: string) => void }) {
  const id = 'attribute-value';
  if (definition.dataType === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <Checkbox id={id} checked={value === 'true'} onCheckedChange={(checked) => onChange(checked === true ? 'true' : 'false')} />
        <Label htmlFor={id}>{definition.displayName}</Label>
      </div>
    );
  }
  if (definition.dataType === 'date') return <DateInput id={id} label={definition.displayName} value={value} onChange={onChange} />;
  if (definition.dataType === 'select') {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{definition.displayName}</Label>
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Choose a value" />
          </SelectTrigger>
          <SelectContent>
            {(definition.selectOptions ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{definition.displayName}</Label>
      <Input
        id={id}
        value={value}
        inputMode={definition.dataType === 'number' ? 'decimal' : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/** Edit one custom attribute value of a unit or asset (a short dialog: one field). */
export function AttributeValueDialog({ definition, value, saving, onSave, onClose }: AttributeValueDialogProps) {
  const [draft, setDraft] = useState(value);
  const invalidNumber = definition.dataType === 'number' && draft.trim() !== '' && Number.isNaN(Number(draft));
  const missing = definition.isRequired && draft.trim() === '';
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {definition.displayName}</DialogTitle>
          {definition.description && <DialogDescription>{definition.description}</DialogDescription>}
        </DialogHeader>
        <ValueInput definition={definition} value={draft} onChange={setDraft} />
        {invalidNumber && <p className="text-sm text-destructive">Enter a number.</p>}
        {missing && <p className="text-sm text-destructive">This attribute is required.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || invalidNumber || missing} onClick={() => void onSave(draft).then(onClose, () => undefined)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
