import { X } from 'lucide-react';
import type { RuleKind, RulesSchemaView } from '@/api/v2/types/rules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import type { Option } from '../hooks/use-reference-options';
import type { ActionRow } from '../model/rule-form';

export interface ActionRowEditorProps {
  row: ActionRow;
  kind: RuleKind;
  schema: RulesSchemaView;
  impactCodes: Option[] | null;
  errors: string[];
  disabled?: boolean;
  onChange: (changes: Partial<ActionRow>) => void;
  onRemove: () => void;
}

/** "set <field> to <value>" with the targets the rule kind allows, or "flag <code>". */
export function ActionRowEditor({ row, kind, schema, impactCodes, errors, disabled, onChange, onRemove }: ActionRowEditorProps) {
  const spec = schema.kinds.find((entry) => entry.kind === kind);
  const target = spec?.sets.find((entry) => entry.field === row.field);
  const values = target?.values ? target.values.map((value) => ({ value, label: value })) : target?.references ? (impactCodes ?? []) : [];
  return (
    <div className="space-y-1" data-testid="rule-action" data-row={row.key} data-invalid={errors.length > 0}>
      <fieldset disabled={disabled} className="grid gap-2 sm:grid-cols-[auto_1fr_1.5fr_auto] sm:items-center">
        {row.type === 'set' ? (
          <>
            <span className="text-sm">set</span>
            <NativeSelect
              id={`${row.key}-target`}
              testId="action-target"
              ariaLabel="Field to set"
              value={row.field}
              onChange={(value) => onChange({ field: value, value: '' })}
              placeholder="Field…"
              options={(spec?.sets ?? []).map((entry) => ({ value: entry.field, label: entry.label }))}
            />
            <NativeSelect id={`${row.key}-set`} testId="action-value" ariaLabel="Value to set" value={row.value} onChange={(value) => onChange({ value })} placeholder="Value…" options={values} />
          </>
        ) : (
          <>
            <span className="text-sm">flag</span>
            <Input
              id={`${row.key}-flag`}
              data-testid="action-flag"
              aria-label="Flag code"
              className="sm:col-span-2"
              placeholder="lowercase_code, e.g. rca_recommended"
              value={row.value}
              onChange={(event) => onChange({ value: event.target.value })}
            />
          </>
        )}
        <Button type="button" variant="ghost" size="icon" aria-label="Remove action" onClick={onRemove}>
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
