import { useState } from 'react';
import { useCodeList, useCreateCode, type CodeCreateBody } from '@/api/v2/queries/codes-admin';
import type { CodeLibraryPath, FailureGroupKind } from '@/api/v2/types/codes-admin';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/features/integration-console/components/field';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { FAILURE_GROUP_KIND_LABELS } from '@/features/ux-kit/labels';
import { AdminRefusalAlert } from '../components/admin-refusal-alert';
import { FAILURE_KINDS, LIBRARIES, singularLabel } from '../model/code-fields';
import { failureLevelFits } from '../model/code-tree';

export interface CodeCreateDialogProps {
  library: CodeLibraryPath;
  /** proposed parent (the code whose page the dialog was opened from) */
  parentId: string | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}

const KIND_OPTIONS = FAILURE_KINDS.map((kind) => ({ value: kind, label: FAILURE_GROUP_KIND_LABELS[kind] }));

/**
 * New code (version 1) under an optional parent; duplicates (409) and bad parents (422) come from the
 * server. Mounted while open, so every opening starts from an empty form.
 */
export function CodeCreateDialog({ library, parentId, onClose, onCreated }: CodeCreateDialogProps) {
  const spec = LIBRARIES[library];
  const create = useCreateCode(library);
  const lookup = useCodeList(library, {});
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [parent, setParent] = useState(spec.hierarchical && parentId ? parentId : '');
  const [groupKind, setGroupKind] = useState<FailureGroupKind>('class');
  const parents = lookup.items.filter((entry) => entry.active && (library !== 'failure-code-groups' || failureLevelFits(groupKind, entry.groupKind)));
  const submit = async () => {
    const body: CodeCreateBody = { code: code.trim(), name: name.trim() };
    if (spec.hierarchical) body.parentId = parent || null;
    if (library === 'failure-code-groups') body.groupKind = groupKind;
    const created = await create.submit(body).catch(() => null);
    if (created) onCreated(created.id);
  };
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col" data-testid="code-create-dialog">
        <DialogHeader>
          <DialogTitle>New {singularLabel(library).toLowerCase()}</DialogTitle>
          <DialogDescription>Codes are live as soon as they are created. Every later change is a new version.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          <Field id="new-code" label="Code" hint="Unique in this library; letters, digits and . _ : -">
            <Input id="new-code" value={code} onChange={(event) => setCode(event.target.value)} />
          </Field>
          <Field id="new-name" label="Name">
            <Input id="new-name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          {library === 'failure-code-groups' && (
            <Field id="new-kind" label="Level">
              <NativeSelect id="new-kind" value={groupKind} onChange={(value) => setGroupKind(value as FailureGroupKind)} options={KIND_OPTIONS} />
            </Field>
          )}
          {spec.hierarchical && (
            <Field id="new-parent" label="Parent">
              <NativeSelect
                id="new-parent"
                testId="new-parent"
                value={parent}
                onChange={setParent}
                placeholder="(top level)"
                disabled={lookup.isLoading}
                options={parents.map((entry) => ({ value: entry.id, label: `${entry.code} — ${entry.name}` }))}
              />
            </Field>
          )}
          {create.error ? <AdminRefusalAlert error={create.error} /> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending || code.trim() === '' || name.trim() === ''} data-testid="code-create-submit">
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
