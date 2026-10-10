import { RCA_PRIORITIES, RCA_STATUSES, type RcaPriority, type RcaStatus } from '@/api/v2/types/rca';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ChoiceProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}

function Choice<T extends string>({ id, label, value, options, onChange }: ChoiceProps<T>) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(options.find((option) => option === next) ?? value)}>
        <SelectTrigger id={id} aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function PrioritySelect(props: { id: string; value: RcaPriority; onChange: (value: RcaPriority) => void }) {
  return <Choice label="Priority" options={RCA_PRIORITIES} {...props} />;
}

export function StatusSelect(props: { id: string; value: RcaStatus; onChange: (value: RcaStatus) => void }) {
  return <Choice label="Status" options={RCA_STATUSES} {...props} />;
}
