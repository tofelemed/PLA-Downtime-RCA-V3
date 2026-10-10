import { X } from 'lucide-react';
import type { RulesSchemaView } from '@/api/v2/types/rules';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import type { Option } from '../hooks/use-reference-options';
import type { ConditionRow } from '../model/rule-form';
import { ValueInput } from './value-input';

export interface ConditionRowEditorProps {
  row: ConditionRow;
  schema: RulesSchemaView;
  references: Record<string, Option[] | null>;
  errors: string[];
  disabled?: boolean;
  onChange: (changes: Partial<ConditionRow>) => void;
  onRemove: () => void;
}

/** field · operator · value, all from the server's allowlist (`GET /rules/schema`). */
export function ConditionRowEditor({ row, schema, references, errors, disabled, onChange, onRemove }: ConditionRowEditorProps) {
  const field = schema.fields.find((entry) => entry.name === row.field);
  const operator = schema.operators.find((entry) => entry.op === row.op);
  const allowed = schema.operators.filter((entry) => field?.operators.includes(entry.op));
  return (
    <div className="space-y-1" data-testid="rule-condition" data-row={row.key} data-invalid={errors.length > 0}>
      <fieldset disabled={disabled} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.5fr_auto]">
        <NativeSelect
          id={`${row.key}-field`}
          testId="rule-field"
          ariaLabel="Field"
          value={row.field}
          onChange={(value) => onChange({ field: value, op: '', value: '' })}
          placeholder="Field…"
          options={schema.fields.map((entry) => ({ value: entry.name, label: entry.label }))}
        />
        <NativeSelect
          id={`${row.key}-op`}
          testId="rule-op"
          ariaLabel="Operator"
          value={row.op}
          onChange={(value) => onChange({ op: value as ConditionRow['op'] })}
          placeholder="Operator…"
          options={allowed.map((entry) => ({ value: entry.op, label: entry.label }))}
        />
        <ValueInput
          id={`${row.key}-value`}
          field={field}
          operator={operator}
          value={row.value}
          onChange={(value) => onChange({ value })}
          references={field?.references ? (references[field.references] ?? null) : null}
        />
        <Button type="button" variant="ghost" size="icon" aria-label="Remove condition" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </fieldset>
      {errors.map((message) => (
        <p key={message} role="alert" className="text-xs text-destructive" data-testid="row-error">
          {message}
        </p>
      ))}
    </div>
  );
}
