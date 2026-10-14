import { RCA_PRIORITIES, type RcaPriority } from '@/api/v2/types/rca';
import { RCA_CONSEQUENCE_CLASSES, type RcaConsequenceClass } from '@/api/v2/types/rca-workflow';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RCA_CONSEQUENCE_LABELS } from '@/features/ux-kit/labels/rca-labels';

interface ChoiceProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  labels?: Readonly<Record<string, string>>;
  hint?: string;
  onChange: (value: T) => void;
}

function Choice<T extends string>({ id, label, value, options, labels, hint, onChange }: ChoiceProps<T>) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(options.find((option) => option === next) ?? value)}>
        <SelectTrigger id={id} aria-label={label} aria-describedby={hint ? `${id}-hint` : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labels?.[option] ?? option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function PrioritySelect(props: { id: string; value: RcaPriority; onChange: (value: RcaPriority) => void }) {
  return <Choice label="Priority" options={RCA_PRIORITIES} {...props} />;
}

const UNCLASSIFIED = 'unclassified';
const CONSEQUENCE_OPTIONS = [UNCLASSIFIED, ...RCA_CONSEQUENCE_CLASSES] as const;
const CONSEQUENCE_LABELS = { ...RCA_CONSEQUENCE_LABELS, [UNCLASSIFIED]: 'Not classified' };

/** CA7 consequence class (actual or potential): decides which analysis methods and team size the server asks for. */
export function ConsequenceSelect(props: { id: string; value: RcaConsequenceClass | null; onChange: (value: RcaConsequenceClass | null) => void }) {
  return (
    <Choice
      id={props.id}
      label="Consequence class"
      value={props.value ?? UNCLASSIFIED}
      options={CONSEQUENCE_OPTIONS}
      labels={CONSEQUENCE_LABELS}
      hint="Actual or potential consequence; sets the methods and team the investigation needs."
      onChange={(next) => props.onChange(next === UNCLASSIFIED ? null : next)}
    />
  );
}
