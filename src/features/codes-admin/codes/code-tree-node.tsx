import { Link } from 'react-router-dom';
import { useCodeChildren } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FAILURE_GROUP_KIND_LABELS, labelOf } from '@/features/ux-kit/labels';
import { IconButton } from '@/features/ux-kit/icon-button';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { UiIcon } from '@/lib/icons';
import { canHaveChildren } from '../model/code-tree';

/** What every node of one tree shares: the library, the retired filter and the expanded nodes. */
export interface CodeTreeContext {
  library: CodeLibraryPath;
  includeRetired: boolean;
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
  /** seeds the detail page cache on hover / focus */
  seed: (code: CodeDetailView) => void;
}

interface NodeProps {
  code: CodeDetailView;
  depth: number;
  tree: CodeTreeContext;
}

/** The sub-codes of an expanded node, loaded when it opens (pages of 100, "Show more" for the rest). */
function CodeTreeChildren({ code, depth, tree }: NodeProps) {
  const children = useCodeChildren(tree.library, code.id, tree.includeRetired, true);
  const state = dataStateOf(children, { isEmpty: false });
  if (state === 'ready' && children.items.length === 0) {
    return <p className="py-1 text-xs text-muted-foreground" style={{ paddingLeft: `${(depth + 1) * 1.5 + 2}rem` }}>No sub-codes.</p>;
  }
  return (
    <DataState state={state} error={children.error} onRetry={() => void children.refetch()}>
      <ul aria-label={`Sub-codes of ${code.code}`}>
        {children.items.map((child) => (
          <CodeTreeNode key={child.id} code={child} depth={depth + 1} tree={tree} />
        ))}
      </ul>
      {children.hasNextPage && (
        <Button variant="link" size="sm" style={{ marginLeft: `${(depth + 1) * 1.5 + 2}rem` }} onClick={() => void children.fetchNextPage()} disabled={children.isFetchingNextPage}>
          Show more sub-codes
        </Button>
      )}
    </DataState>
  );
}

/** One code of the tree: a disclosure for its sub-codes and a link to its page. */
export function CodeTreeNode({ code, depth, tree }: NodeProps) {
  const expandable = canHaveChildren(code);
  const open = expandable && tree.isExpanded(code.id);
  return (
    <li data-testid="code-row" data-code={code.code} data-depth={depth} data-parent={code.parentId ?? ''} data-expanded={open}>
      <div className="flex items-center gap-1 rounded px-1 py-0.5 text-sm hover:bg-muted/60" style={{ paddingLeft: `${depth * 1.5 + 0.25}rem` }}>
        {expandable ? (
          <IconButton
            icon={open ? UiIcon.chevronDown : UiIcon.chevronRight}
            label={`${open ? 'Hide' : 'Show'} sub-codes of ${code.code}`}
            tooltip={false}
            className="h-7 w-7"
            aria-expanded={open}
            data-testid="code-expand"
            onClick={() => tree.toggle(code.id)}
          />
        ) : (
          <span className="inline-block w-7" aria-hidden="true" />
        )}
        <Link
          to={`/master-data/codes-rules/${tree.library}/${code.id}`}
          className="min-w-0 flex-1 truncate rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="code-select"
          onMouseEnter={() => tree.seed(code)}
          onFocus={() => tree.seed(code)}
        >
          <span className="font-mono">{code.code}</span> <span className="text-muted-foreground">{code.name}</span>
        </Link>
        {code.groupKind && <Badge variant="outline">{labelOf(FAILURE_GROUP_KIND_LABELS, code.groupKind)}</Badge>}
        {!code.active && <Badge variant="secondary">Retired</Badge>}
      </div>
      {open && <CodeTreeChildren code={code} depth={depth} tree={tree} />}
    </li>
  );
}
