import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { WEEK_START_CHOICES } from './week-start-choices';

export interface WeekStartFormProps {
  saved: string;
  canEdit: boolean;
  pending: boolean;
  error: unknown;
  onSave: (weekStart: string) => void;
}

/**
 * DT-10: the first day of the plant's reporting week, any of the seven days — weekly trends and reports group
 * the seven days from it. Which days are worked is set by the shift calendar, not here.
 */
export function WeekStartForm({ saved, canEdit, pending, error, onSave }: WeekStartFormProps) {
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  return (
    <div className="space-y-3">
      <RadioGroup value={draft} onValueChange={setDraft} disabled={!canEdit} aria-label="First day of the week" className="grid gap-2">
        {WEEK_START_CHOICES.map((choice) => (
          <div key={choice.value} className="flex items-center gap-2">
            <RadioGroupItem id={`week-${choice.value}`} value={choice.value} aria-describedby={`week-${choice.value}-hint`} />
            <Label htmlFor={`week-${choice.value}`} className="font-normal">{choice.label}</Label>
            <span id={`week-${choice.value}-hint`} className="text-sm text-muted-foreground">({choice.hint})</span>
          </div>
        ))}
      </RadioGroup>
      {error ? <FriendlyErrorAlert error={error} /> : null}
      {canEdit ? (
        <Button onClick={() => onSave(draft)} disabled={draft === saved || pending} data-testid="save-week-start">
          {pending ? 'Saving…' : 'Save'}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Only a plant administrator or a manager approver of this plant can change the week start.</p>
      )}
    </div>
  );
}
