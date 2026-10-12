import { useState } from 'react';
import { useChangeCode, useCodeList } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { Button } from '@/components/ui/button';
import { Field } from '@/features/integration-console/components/field';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { AdminRefusalAlert } from '../components/admin-refusal-alert';
import { moveTargets } from '../model/code-tree';

export interface CodeMoveFormProps {
  library: CodeLibraryPath;
  code: CodeDetailView;
}

/** "Move under": a new parent for the code; the server re-paths the subtree and refuses cycles (422). */
export function CodeMoveForm({ library, code }: CodeMoveFormProps) {
  const lookup = useCodeList(library, {});
  const change = useChangeCode(library);
  const [parentId, setParentId] = useState('');
  const options = [
    ...(code.parentId ? [{ value: 'root', label: '(top level)' }] : []),
    ...moveTargets(lookup.items, code.id).map((entry) => ({ value: entry.id, label: `${entry.code} — ${entry.name}` })),
  ];
  const move = () =>
    change
      .submit({ code, body: { parentId: parentId === 'root' ? null : parentId } })
      .then(() => setParentId(''))
      .catch(() => undefined);
  return (
    <div className="space-y-2" data-testid="code-move">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-80">
          <Field id="code-move-target" label="Move under">
            <NativeSelect id="code-move-target" testId="code-move-target" value={parentId} onChange={setParentId} placeholder="Choose a new parent…" options={options} disabled={lookup.isLoading} />
          </Field>
        </div>
        <Button variant="outline" onClick={move} disabled={parentId === '' || change.isPending} data-testid="code-move-submit">
          Move
        </Button>
      </div>
      {change.error ? <AdminRefusalAlert error={change.error} /> : null}
    </div>
  );
}
