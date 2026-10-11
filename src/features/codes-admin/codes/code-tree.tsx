import { useMemo, useState, type DragEvent } from 'react';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { CodeDetailView } from '@/api/v2/types/codes-admin';
import { canDrop, treeRows } from '../model/code-tree';

export interface CodeTreeProps {
  codes: readonly CodeDetailView[];
  selectedId: string | null;
  hierarchical: boolean;
  onSelect: (id: string) => void;
  /** drag-reparent (null = make root); the server validates cycles and levels */
  onMove: (id: string, parentId: string | null) => void;
  /** false for users who cannot write codes: no drag handles, no drop zone */
  movable?: boolean;
}

const DRAG_TYPE = 'application/x-proact-code';

/** The library as a tree (flat list for non-hierarchical libraries); drag a code onto another to move it. */
export function CodeTree({ codes, selectedId, hierarchical: tree, onSelect, onMove, movable = true }: CodeTreeProps) {
  const hierarchical = tree && movable;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragged, setDragged] = useState<string | null>(null);
  // the row whose handle was pressed: a drag that starts anywhere else is cancelled (never move the wrong code)
  const [armed, setArmed] = useState<string | null>(null);
  const rows = useMemo(() => treeRows(codes, collapsed), [codes, collapsed]);
  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const drop = (event: DragEvent, parentId: string | null) => {
    event.preventDefault();
    const id = dragged ?? event.dataTransfer.getData(DRAG_TYPE);
    setDragged(null);
    setArmed(null);
    if (id && canDrop(codes, id, parentId)) onMove(id, parentId);
  };
  const allowDrop = (event: DragEvent, parentId: string | null) => {
    if (dragged && canDrop(codes, dragged, parentId)) event.preventDefault();
  };
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No codes yet.</p>;
  return (
    <div role="tree" aria-label="Codes" className="space-y-0.5" data-testid="code-tree">
      {rows.map(({ code, depth, hasChildren }) => (
        <div
          key={code.id}
          role="treeitem"
          aria-level={depth + 1}
          aria-selected={code.id === selectedId}
          aria-expanded={hasChildren ? !collapsed.has(code.id) : undefined}
          data-testid="code-row"
          data-code={code.code}
          data-depth={depth}
          data-parent={code.parentId ?? ''}
          draggable={hierarchical && code.active}
          onDragStart={(event) => {
            if (armed !== code.id) {
              event.preventDefault();
              return;
            }
            event.dataTransfer.setData(DRAG_TYPE, code.id);
            setDragged(code.id);
          }}
          onDragEnd={() => {
            setDragged(null);
            setArmed(null);
          }}
          onDragOver={(event) => allowDrop(event, code.id)}
          onDrop={(event) => drop(event, code.id)}
          className={`flex items-center gap-1 rounded px-1 py-1 text-sm ${code.id === selectedId ? 'bg-muted' : ''}`}
          style={{ paddingLeft: `${depth * 1.25 + 0.25}rem` }}
        >
          {hierarchical && code.active && (
            <span className="cursor-grab text-muted-foreground" title="Drag onto another code to move it" data-testid="drag-handle" onMouseDown={() => setArmed(code.id)}>
              <GripVertical className="h-4 w-4" aria-hidden />
            </span>
          )}
          {hasChildren ? (
            <button type="button" aria-label={collapsed.has(code.id) ? `Expand ${code.code}` : `Collapse ${code.code}`} onClick={() => toggle(code.id)}>
              {collapsed.has(code.id) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : (
            <span className="inline-block w-4" />
          )}
          <button type="button" className="flex-1 truncate text-left" onClick={() => onSelect(code.id)} data-testid="code-select">
            <span className="font-mono">{code.code}</span> <span className="text-muted-foreground">{code.name}</span>
          </button>
          {code.groupKind && <Badge variant="outline">{code.groupKind}</Badge>}
          {!code.active && <Badge variant="secondary">retired</Badge>}
        </div>
      ))}
      {hierarchical && (
        <div
          data-testid="drop-root"
          onDragOver={(event) => allowDrop(event, null)}
          onDrop={(event) => drop(event, null)}
          className="mt-2 rounded border border-dashed p-2 text-center text-xs text-muted-foreground"
        >
          Drop here to make a top-level code
        </div>
      )}
    </div>
  );
}
