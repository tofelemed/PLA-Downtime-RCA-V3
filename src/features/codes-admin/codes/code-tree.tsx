import { useCallback, useState } from 'react';
import { useCodeRoots, useSeedCode } from '@/api/v2/queries/codes-admin';
import type { CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { ListPager } from '@/features/ux-kit/data-table';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { EmptyMessage } from '@/features/ux-kit/data-table/data-table-states';
import { CODE_LIBRARY_EMPTY } from '../model/code-fields';
import { CodeTreeNode, type CodeTreeContext } from './code-tree-node';

export interface CodeTreeProps {
  library: CodeLibraryPath;
  includeRetired: boolean;
}

/**
 * A hierarchical library as a tree that starts collapsed: the top-level codes 20 per page, sub-codes
 * loaded when a node is opened. Never the whole tenant's tree at once (search finds deep codes).
 */
export function CodeTree({ library, includeRetired }: CodeTreeProps) {
  const roots = useCodeRoots(library, true, includeRetired);
  const seedCode = useSeedCode();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useCallback(
    (id: string) =>
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const tree: CodeTreeContext = { library, includeRetired, isExpanded: (id) => expanded.has(id), toggle, seed: (code) => seedCode(library, code) };
  const state = dataStateOf(roots.status, { isEmpty: false });
  if (state === 'ready' && roots.rows.length === 0) {
    return (
      <div className="rounded-md border p-6" data-testid="code-tree-empty">
        <EmptyMessage empty={CODE_LIBRARY_EMPTY} />
      </div>
    );
  }
  return (
    <DataState state={state} error={roots.status.error} onRetry={roots.status.onRetry}>
      <div className="space-y-3">
        <ul aria-label="Codes" className="rounded-md border p-1" data-testid="code-tree">
          {roots.rows.map((code) => (
            <CodeTreeNode key={code.id} code={code} depth={0} tree={tree} />
          ))}
        </ul>
        <ListPager pager={roots.pager} label="Top-level code pages" />
      </div>
    </DataState>
  );
}
