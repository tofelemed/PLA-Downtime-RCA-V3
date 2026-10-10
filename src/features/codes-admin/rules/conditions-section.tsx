import type { RulesSchemaView } from '@/api/v2/types/rules';
import { Button } from '@/components/ui/button';
import type { Option } from '../hooks/use-reference-options';
import type { RuleDraftState } from '../hooks/use-rule-draft';
import type { ConditionList, RowErrors } from '../model/rule-form';
import { ActionRowEditor } from './action-row';
import { ConditionRowEditor } from './condition-row';

interface SectionProps {
  state: RuleDraftState;
  schema: RulesSchemaView;
  references: Record<string, Option[] | null>;
  errors: RowErrors;
  disabled: boolean;
}

const TITLES: Record<ConditionList, string> = {
  all: 'When all of these hold',
  any: 'and at least one of these holds',
};

/** One condition list of the rule (`when.all` or `when.any`). */
export function ConditionsSection({ list, state, schema, references, errors, disabled }: SectionProps & { list: ConditionList }) {
  const rows = state.draft[list];
  return (
    <section className="space-y-2" data-testid={`conditions-${list}`} aria-label={TITLES[list]}>
      <h3 className="text-sm font-medium">{TITLES[list]}</h3>
      {rows.length === 0 && <p className="text-xs text-muted-foreground">{list === 'any' ? 'Optional.' : 'No conditions.'}</p>}
      {rows.map((row) => (
        <ConditionRowEditor
          key={row.key}
          row={row}
          schema={schema}
          references={references}
          errors={errors.rows[row.key] ?? []}
          disabled={disabled}
          onChange={(changes) => state.updateCondition(list, row.key, changes)}
          onRemove={() => state.removeCondition(list, row.key)}
        />
      ))}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => state.addCondition(list)} data-testid={`add-condition-${list}`}>
        Add condition
      </Button>
    </section>
  );
}

/** The `then` actions of the rule, limited to what its kind allows. */
export function ActionsSection({ state, schema, references, errors, disabled }: SectionProps) {
  const spec = schema.kinds.find((entry) => entry.kind === state.draft.kind);
  return (
    <section className="space-y-2" data-testid="rule-actions" aria-label="Then">
      <h3 className="text-sm font-medium">Then</h3>
      {state.draft.actions.map((row) => (
        <ActionRowEditor
          key={row.key}
          row={row}
          kind={state.draft.kind}
          schema={schema}
          impactCodes={references.impact_code ?? null}
          errors={errors.rows[row.key] ?? []}
          disabled={disabled}
          onChange={(changes) => state.updateAction(row.key, changes)}
          onRemove={() => state.removeAction(row.key)}
        />
      ))}
      <div className="flex gap-2">
        {spec && spec.sets.length > 0 && (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => state.addAction('set')}>
            Add “set”
          </Button>
        )}
        {spec?.flags && (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => state.addAction('flag')}>
            Add flag
          </Button>
        )}
      </div>
    </section>
  );
}
