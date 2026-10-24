import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCodeList, useCreateCode } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath, FailureGroupKind } from '@/api/v2/types/codes-admin';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Field } from '@/features/integration-console/components/field';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { COMPACT_FIELDS } from '@/features/master-data/components/compact-fields';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { focusFirstField } from '@/features/ux-kit/focus-first-field';
import { FAILURE_GROUP_KIND_LABELS } from '@/features/ux-kit/labels';
import { SaveResultDialog, type SaveResult } from '@/features/ux-kit/save-result';
import { useCodesSaveFeedback } from '../hooks/use-codes-save-feedback';
import { useNewCodeForm } from '../hooks/use-new-code-form';
import { FAILURE_KINDS, LIBRARIES, singularLabel } from '../model/code-fields';
import { codeCreatedResult } from '../model/codes-save-result';
import { failureLevelFits } from '../model/code-tree';
import { createDisabledReason, newCodeErrors } from '../model/new-code';

export interface CodeCreateDialogProps {
  library: CodeLibraryPath;
  /** proposed parent (the code whose page the dialog was opened from) */
  parentId: string | null;
  /** the dialog and its result dialog are done (cancelled, or an action of the result chosen) */
  onClose: () => void;
}

const CREATE_INFO = 'Codes are live as soon as they are created. Every later change is a new version.';

const KIND_OPTIONS = FAILURE_KINDS.map((kind) => ({ value: kind, label: FAILURE_GROUP_KIND_LABELS[kind] }));

/** The result dialog of a create; "Add another" brings the empty form back instead of closing. */
function useCreatedResult(onClose: () => void, resetForm: () => void) {
  const [result, setResult] = useState<SaveResult | null>(null);
  const addingAnother = useRef(false);
  const addAnother = () => {
    addingAnother.current = true;
    resetForm();
  };
  const close = () => {
    setResult(null);
    if (addingAnother.current) addingAnother.current = false;
    else onClose();
  };
  return { result, show: setResult, addAnother, close };
}

interface NewCodeFieldsProps {
  library: CodeLibraryPath;
  form: ReturnType<typeof useNewCodeForm>;
  codeError: string | undefined;
  parents: readonly CodeDetailView[];
  loading: boolean;
}

/** Code, name, level (failure groups) and parent of the new code. */
function NewCodeFields({ library, form, codeError, parents, loading }: NewCodeFieldsProps) {
  return (
    <>
      <Field id="new-code" label="Code" required hint="Unique in this library; letters, digits and . _ : -" error={codeError}>
        <Input id="new-code" value={form.code} onChange={(event) => form.setCode(event.target.value)} />
      </Field>
      <Field id="new-name" label="Name" required>
        <Input id="new-name" value={form.name} onChange={(event) => form.setName(event.target.value)} />
      </Field>
      {library === 'failure-code-groups' && (
        <Field id="new-kind" label="Level">
          <NativeSelect id="new-kind" value={form.groupKind} onChange={(value) => form.setGroupKind(value as FailureGroupKind)} options={KIND_OPTIONS} />
        </Field>
      )}
      {LIBRARIES[library].hierarchical && (
        <Field id="new-parent" label="Parent">
          <NativeSelect
            id="new-parent"
            testId="new-parent"
            value={form.parent}
            onChange={form.setParent}
            placeholder="(top level)"
            disabled={loading}
            options={parents.map((entry) => ({ value: entry.id, label: `${entry.code} — ${entry.name}` }))}
          />
        </Field>
      )}
    </>
  );
}

/**
 * New code (version 1) under an optional parent; duplicates (409) and bad parents (422) come from the
 * server and show as the red alert at the top of the dialog, the input kept. A create ends in the result
 * dialog (View code · Add another · Back to Code libraries · Next). Mounted while open, so every opening
 * starts from an empty form.
 */
export function CodeCreateDialog({ library, parentId, onClose }: CodeCreateDialogProps) {
  const spec = LIBRARIES[library];
  const body = useRef<HTMLDivElement>(null);
  const create = useCreateCode(library);
  const lookup = useCodeList(library, {});
  const capabilities = useCapabilities();
  const feedback = useCodesSaveFeedback();
  const form = useNewCodeForm(library, spec.hierarchical && parentId ? parentId : '');
  const created = useCreatedResult(onClose, () => { form.reset(); feedback.clearFailure(); });
  const errors = newCodeErrors(form.code, lookup.items.map((entry) => entry.code));
  const disabledReason = createDisabledReason(form.code, form.name, errors);
  const parents = lookup.items.filter((entry) => entry.active && (library !== 'failure-code-groups' || failureLevelFits(form.groupKind, entry.groupKind)));
  const submit = async () => {
    const saved = await feedback.run(() => create.submit(form.body()), null).catch(() => null);
    if (saved) created.show(codeCreatedResult(library, saved, { capabilities, onAddAnother: created.addAnother }));
  };
  return (
    <>
      <Dialog open={created.result === null} onOpenChange={(next) => !next && onClose()}>
        <DialogContent
          className="flex max-h-[90vh] flex-col"
          data-testid="code-create-dialog"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => focusFirstField(body.current, event)}
        >
          <DialogHeader>
            <div className="flex items-center gap-1.5">
              <DialogTitle>New {singularLabel(library).toLowerCase()}</DialogTitle>
              <KpiInfo label="new codes" text={CREATE_INFO} />
            </div>
          </DialogHeader>
          <div ref={body} className={cn('min-h-0 flex-1 space-y-3 overflow-y-auto px-1 pb-1', COMPACT_FIELDS)}>
            {feedback.alert}
            <NewCodeFields library={library} form={form} codeError={errors.code} parents={parents} loading={lookup.isLoading} />
          </div>
          <DisabledReason id="code-create-reason" reason={create.isPending ? null : disabledReason} />
          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={onClose}>
              Cancel
            </Button>
            <Button className="h-9" onClick={submit} disabled={create.isPending || disabledReason !== null} aria-describedby={disabledReason ? 'code-create-reason' : undefined} data-testid="code-create-submit">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SaveResultDialog result={created.result} onClose={created.close} />
    </>
  );
}
