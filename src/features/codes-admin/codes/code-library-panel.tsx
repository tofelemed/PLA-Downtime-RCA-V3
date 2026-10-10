import { useState } from 'react';
import { useChangeCode, useCodeList } from '@/api/v2/queries/codes-admin';
import type { CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { AdminRefusalAlert } from '../components/admin-refusal-alert';
import { LIBRARIES } from '../model/code-fields';
import { CodeCreateDialog } from './code-create-dialog';
import { CodeDetail } from './code-detail';
import { CodeTree } from './code-tree';

/**
 * One code library of the acting tenant (plan 3.8): tree or list, drag-reparent (the server re-paths
 * the subtree and refuses cycles), node editor with versions, retire with impact.
 */
export function CodeLibraryPanel({ library }: { library: CodeLibraryPath }) {
  const spec = LIBRARIES[library];
  const [includeRetired, setIncludeRetired] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useCodeList(library, { includeRetired });
  const move = useChangeCode(library);
  const selected = list.items.find((code) => code.id === selectedId) ?? null;
  const onMove = (id: string, parentId: string | null) => {
    const code = list.items.find((entry) => entry.id === id);
    if (code) move.submit({ code, body: { parentId } }).catch(() => undefined);
  };
  const state = dataStateOf(list, { isEmpty: false });
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]" data-testid="code-library" data-library={library}>
      <section className="space-y-2" aria-label={spec.label}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox id={`${library}-retired`} checked={includeRetired} onCheckedChange={(value) => setIncludeRetired(value === true)} />
            <Label htmlFor={`${library}-retired`} className="text-xs">
              Show retired
            </Label>
          </div>
          <Button size="sm" onClick={() => setCreating(true)} data-testid="code-new">
            New code
          </Button>
        </div>
        {move.error ? <AdminRefusalAlert error={move.error} /> : null}
        <DataState state={state} error={list.error} onRetry={() => list.refetch()}>
          <CodeTree codes={list.items} selectedId={selectedId} hierarchical={spec.hierarchical} onSelect={setSelectedId} onMove={onMove} />
        </DataState>
      </section>
      {selected ? (
        <CodeDetail key={selected.id} library={library} code={selected} codes={list.items} />
      ) : (
        <p className="text-sm text-muted-foreground">Select a code to edit it, see its versions or retire it.</p>
      )}
      {creating && (
        <CodeCreateDialog
          library={library}
          codes={list.items}
          parentId={selected?.id ?? null}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}
