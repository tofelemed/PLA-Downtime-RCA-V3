import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { V2ApiError } from '@/api/v2/errors';
import { useRuleCheck } from '@/api/v2/queries/rules';
import type { RuleKind, RulesSchemaView, RuleView } from '@/api/v2/types/rules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/features/integration-console/components/field';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useDebouncedValue } from '@/features/ux-kit/use-debounced-value';
import { hasUnsavedChanges, useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { useReferenceOptions } from '../hooks/use-reference-options';
import { useRuleDraft } from '../hooks/use-rule-draft';
import { useRuleSave } from '../hooks/use-rule-save';
import { RULES_LIST_PATH } from '../model/codes-save-result';
import { definitionOf, draftOf, emptyDraft, errorsByRow, RuleDraft } from '../model/rule-form';
import { ActionsSection, ConditionsSection } from './conditions-section';
import { ValidationSummary } from './validation-summary';

export interface RuleEditorProps {
  schema: RulesSchemaView;
  /** null = a new rule */
  rule: RuleView | null;
}

function initialDraft(rule: RuleView | null): RuleDraft {
  if (!rule) return emptyDraft();
  const definition = rule.draft?.definition ?? rule.activeDefinition;
  const base = { kind: rule.kind, name: rule.name, description: rule.description ?? '', priority: String(rule.priority) };
  return definition ? draftOf(base, definition) : { ...emptyDraft(rule.kind), ...base };
}

/**
 * Rule builder (plan 3.8): pickers from the server allowlist, live server validation (the same 422
 * field errors a save gets, placed on their rows), save as a draft. The browser never evaluates a rule.
 * A new rule ends in the result dialog, a saved draft in a toast; the form is clean after either. A refusal
 * is the red alert at the top, the input kept. Cancel goes back to the rules list.
 */
export function RuleEditor({ schema, rule }: RuleEditorProps) {
  const { canAuthorRules } = useCapabilities();
  const initial = useMemo(() => initialDraft(rule), [rule]);
  const state = useRuleDraft(() => initial);
  const { draft } = state;
  // the last saved values: the form is clean again right after a save
  const [baseline, setBaseline] = useState<RuleDraft>(initial);
  // untouched rows stay quiet until a save is attempted (QA re-test N1)
  const [attempted, setAttempted] = useState(false);
  const startOver = () => {
    const fresh = emptyDraft();
    state.replace(fresh);
    setBaseline(fresh);
    setAttempted(false);
  };
  const saving = useRuleSave(rule, startOver);
  const references = useReferenceOptions();
  const definition = useMemo(() => definitionOf(draft, schema), [draft, schema]);
  const checked = useRuleCheck(draft.kind, useDebouncedValue(definition, 400));
  const saveError = saving.failure;
  // the live check runs the save's own validation on the current draft; a refused save fills in until it answers
  const errors = useMemo(
    () => errorsByRow(draft, checked.data?.fieldErrors ?? (saveError instanceof V2ApiError ? saveError.fieldErrors : []), { revealUntouched: attempted }),
    [draft, checked.data, saveError, attempted],
  );
  const readOnly = draft.nested || rule?.state === 'retired' || !canAuthorRules;
  useUnsavedChangesGuard(hasUnsavedChanges(draft, baseline, [readOnly, saving.pending]));
  const save = async () => {
    setAttempted(true);
    const body = { kind: draft.kind, name: draft.name.trim(), description: draft.description.trim() || null, priority: Number(draft.priority) || 0, definition };
    if (await saving.save(body)) setBaseline(draft);
  };
  return (
    <div className="space-y-4" data-testid="rule-editor" data-valid={checked.data?.valid ?? ''}>
      {saving.alert}
      <div className="grid gap-3 md:grid-cols-3">
        <Field id="rule-name" label="Name">
          <Input id="rule-name" value={draft.name} onChange={(event) => state.patch({ name: event.target.value })} disabled={readOnly} />
        </Field>
        <Field id="rule-kind" label="Kind">
          <NativeSelect id="rule-kind" testId="rule-kind" value={draft.kind} onChange={(value) => state.setKind(value as RuleKind)} options={schema.kinds.map((entry) => ({ value: entry.kind, label: entry.label }))} disabled={Boolean(rule)} />
        </Field>
        <Field id="rule-priority" label="Priority (lower runs first)">
          <Input id="rule-priority" type="number" min={0} value={draft.priority} onChange={(event) => state.patch({ priority: event.target.value })} disabled={readOnly} />
        </Field>
      </div>
      <Field id="rule-description" label="Description">
        <Input id="rule-description" value={draft.description} onChange={(event) => state.patch({ description: event.target.value })} disabled={readOnly} />
      </Field>
      {draft.nested && <p className="text-sm text-warning">This definition has nested groups; view it in the version history (the builder edits one level).</p>}
      <ConditionsSection list="all" state={state} schema={schema} references={references} errors={errors} disabled={readOnly} />
      <ConditionsSection list="any" state={state} schema={schema} references={references} errors={errors} disabled={readOnly} />
      <ActionsSection state={state} schema={schema} references={references} errors={errors} disabled={readOnly} />
      <ValidationSummary check={checked.data} checking={checked.isFetching} general={errors.general} limits={schema.limits} />
      {canAuthorRules && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={readOnly || saving.pending || draft.name.trim() === ''} data-testid="rule-save">
            {rule ? 'Save draft' : 'Create draft'}
          </Button>
          <Button variant="outline" asChild>
            <Link to={RULES_LIST_PATH} data-testid="rule-cancel">Cancel</Link>
          </Button>
        </div>
      )}
      {saving.dialog}
    </div>
  );
}
