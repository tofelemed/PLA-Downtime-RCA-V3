import type { RuleFieldSpecView, RuleOperatorView } from '@/api/v2/types/rules';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import type { Option } from '../hooks/use-reference-options';

export interface ValueInputProps {
  id: string;
  field: RuleFieldSpecView | undefined;
  operator: RuleOperatorView | undefined;
  value: string;
  onChange: (value: string) => void;
  /** options of a reference field (null: no list available, the id is typed) */
  references: Option[] | null;
}

/**
 * Value of a condition, typed by the field the schema describes: a picker for enums and references,
 * a number for numbers, text for lists and glob patterns. Never an expression.
 */
export function ValueInput({ id, field, operator, value, onChange, references }: ValueInputProps) {
  if (!field || !operator || operator.value === 'none') return <span className="text-xs text-muted-foreground">no value</span>;
  const label = `Value for ${field.label}`;
  const choices = field.type === 'enum' ? (field.values ?? []).map((entry) => ({ value: entry, label: entry })) : field.type === 'reference' ? references : null;
  if (operator.value === 'single' && choices) {
    return <NativeSelect id={id} testId="rule-value" ariaLabel={label} value={value} onChange={onChange} placeholder="Choose…" options={choices} />;
  }
  const hint =
    operator.value === 'list'
      ? choices
        ? `comma-separated: ${choices.slice(0, 3).map((entry) => entry.value).join(', ')}${choices.length > 3 ? ', …' : ''}`
        : 'comma-separated values'
      : operator.value === 'glob'
        ? 'pattern: * any text, ? one character'
        : field.type === 'reference'
          ? 'record id'
          : undefined;
  return (
    <Input
      id={id}
      data-testid="rule-value"
      aria-label={label}
      type={field.type === 'number' && operator.value === 'single' ? 'number' : 'text'}
      value={value}
      placeholder={hint}
      title={hint}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
