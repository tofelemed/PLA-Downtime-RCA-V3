import { useMemo, useState } from 'react';
import type { RcaCaseCauseView } from '@/api/v2/types/rca-causes';
import { RCA_CAUSE_KINDS } from '@/api/v2/types/rca-causes';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/features/ux-kit/form-field';
import { RCA_CAUSE_KIND_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { RcaErrorAlert } from '../../components/rca-error-alert';
import { asCauseKind, buildCausePatch, CAUSE_STATEMENT_MAX, causeFormOf, causeFormValid, EMPTY_CAUSE_FORM, toggleId, type CauseForm } from '../../model/cause-form';
import { useCaseWorkspace } from '../case-context';
import { CauseCodeSelect } from './cause-code-select';
import { CauseLinkChecklist } from './cause-link-checklist';
import { useCauseSave } from './use-cause-save';

export interface CauseEditorProps {
  /** the cause edited; undefined = a new cause */
  cause?: RcaCaseCauseView;
  onDone: () => void;
}

function useCaseLinkOptions() {
  const { rca } = useCaseWorkspace();
  return useMemo(
    () => ({
      evidence: rca.evidence.map((item) => ({ id: item.id, label: item.title })),
      nodes: rca.logicTree.map((node) => ({ id: node.id, label: node.label })),
    }),
    [rca.evidence, rca.logicTree],
  );
}

/** Item 7: add or change a cause — kind, cause code, statement and the evidence / logic-tree nodes behind it. */
export function CauseEditor({ cause, onDone }: CauseEditorProps) {
  const { rca } = useCaseWorkspace();
  const options = useCaseLinkOptions();
  const initial = useMemo(() => (cause ? causeFormOf(cause) : EMPTY_CAUSE_FORM), [cause]);
  const [form, setForm] = useState<CauseForm>(initial);
  const set = (patch: Partial<CauseForm>) => setForm((current) => ({ ...current, ...patch }));
  const { save, isPending, error } = useCauseSave(rca.id, cause);
  const changed = cause ? Object.keys(buildCausePatch(form, cause)).length > 0 : JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedChangesGuard(changed);
  const prefix = `cause-${cause?.id ?? 'new'}`;
  const submit = async () => {
    if (await save(form)) onDone();
  };
  return (
    <fieldset className="grid min-w-0 gap-3 rounded border p-3 md:grid-cols-2" disabled={isPending} data-testid="cause-editor">
      <legend className="px-1 text-sm font-medium">{cause ? 'Edit cause' : 'New cause'}</legend>
      <FormField id={`${prefix}-kind`} label="Kind">
        <select id={`${prefix}-kind`} className="h-10 w-full rounded border bg-background px-2 text-sm" value={form.kind} onChange={(e) => set({ kind: asCauseKind(e.target.value) })}>
          {RCA_CAUSE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {RCA_CAUSE_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </FormField>
      <CauseCodeSelect id={`${prefix}-code`} value={form.causeCodeId} assigned={cause ?? null} onChange={(causeCodeId) => set({ causeCodeId })} />
      <FormField id={`${prefix}-statement`} label="Statement" required className="md:col-span-2">
        <Textarea id={`${prefix}-statement`} value={form.statement} maxLength={CAUSE_STATEMENT_MAX} onChange={(e) => set({ statement: e.target.value })} />
      </FormField>
      <CauseLinkChecklist legend="Supporting evidence" options={options.evidence} selected={form.evidenceIds} testId="cause-evidence" onToggle={(id) => set({ evidenceIds: toggleId(form.evidenceIds, id, options.evidence.map((o) => o.id)) })} />
      <CauseLinkChecklist legend="Logic-tree nodes" options={options.nodes} selected={form.nodeIds} testId="cause-nodes" onToggle={(id) => set({ nodeIds: toggleId(form.nodeIds, id, options.nodes.map((o) => o.id)) })} />
      <div className="space-y-2 md:col-span-2">
        {error ? <RcaErrorAlert error={error} /> : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!causeFormValid(form) || (cause !== undefined && !changed)} onClick={() => void submit()} data-testid="save-cause">
            {cause ? 'Save cause' : 'Add cause'}
          </Button>
          <Button size="sm" variant="outline" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </div>
    </fieldset>
  );
}
