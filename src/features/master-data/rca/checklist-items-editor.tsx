import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon, UiIcon } from '@/lib/icons';

export interface ChecklistItemsEditorProps {
  items: string[];
  onChange: (items: string[]) => void;
  disabled: boolean;
}

const move = (items: string[], index: number, delta: number): string[] => {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/** The ordered checklist items: add (Enter or button), edit in place, reorder and remove. */
export function ChecklistItemsEditor({ items, onChange, disabled }: ChecklistItemsEditorProps) {
  const [text, setText] = useState('');
  const add = () => {
    const item = text.trim();
    if (!item) return;
    onChange([...items, item]);
    setText('');
  };
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Items</legend>
      {items.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className="flex items-center gap-1">
            <span className="w-6 text-right text-sm text-muted-foreground">{index + 1}.</span>
            <Input
              aria-label={`Item ${index + 1}`}
              defaultValue={item}
              disabled={disabled}
              onBlur={(event) => event.target.value.trim() && onChange(items.map((entry, at) => (at === index ? event.target.value.trim() : entry)))}
            />
            {!disabled && (
              <>
                <IconButton icon={UiIcon.chevronDown} className="rotate-180" label={`Move item ${index + 1} up`} disabled={index === 0} onClick={() => onChange(move(items, index, -1))} />
                <IconButton icon={UiIcon.chevronDown} label={`Move item ${index + 1} down`} disabled={index === items.length - 1} onClick={() => onChange(move(items, index, 1))} />
                <IconButton icon={ActionIcon.remove} label={`Remove item ${index + 1}`} onClick={() => onChange(items.filter((_, at) => at !== index))} />
              </>
            )}
          </li>
        ))}
      </ol>
      {!disabled && (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="new-item">New item</Label>
            <Input
              id="new-item"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  add();
                }
              }}
            />
          </div>
          <Button type="button" variant="outline" onClick={add} disabled={!text.trim()}>
            Add item
          </Button>
        </div>
      )}
    </fieldset>
  );
}
