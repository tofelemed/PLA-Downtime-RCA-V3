import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';

export interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  /** a first choice that emits '' (e.g. "All units") */
  placeholder?: string;
}

/** A filter-bar select of the Asset reliability reports: label above, h-9 control (as on the PLA and Downtime pages). */
export function SelectField({ id, label, value, options, onChange, placeholder }: SelectFieldProps) {
  return (
    <div className={FIELD_CLASS}>
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} value={value} options={options} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}
