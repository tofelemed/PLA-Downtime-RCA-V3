import { CAUSE_LINKS_MAX } from '../../model/cause-form';

export interface CauseLinkOption {
  id: string;
  label: string;
}

export interface CauseLinkChecklistProps {
  legend: string;
  options: readonly CauseLinkOption[];
  selected: readonly string[];
  onToggle: (id: string) => void;
  testId: string;
}

/** Item 7: evidence items or logic-tree nodes of the case supporting a cause (at most 50 each). */
export function CauseLinkChecklist({ legend, options, selected, onToggle, testId }: CauseLinkChecklistProps) {
  if (options.length === 0) return null;
  const full = selected.length >= CAUSE_LINKS_MAX;
  return (
    <fieldset className="min-w-0 space-y-1" data-testid={testId}>
      <legend className="text-sm font-medium">{legend}</legend>
      <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded border p-2 text-sm">
        {options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <li key={option.id}>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={checked} disabled={full && !checked} onChange={() => onToggle(option.id)} />
                <span className="min-w-0 break-words">{option.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {full && <p className="text-xs text-muted-foreground">At most {CAUSE_LINKS_MAX} can be linked.</p>}
    </fieldset>
  );
}
