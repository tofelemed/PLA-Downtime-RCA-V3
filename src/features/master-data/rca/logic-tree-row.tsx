import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon, UiIcon } from '@/lib/icons';
import type { LogicTreeNode } from '../api/master-data-types';

export type NodeAction = 'addChild' | 'edit' | 'up' | 'down' | 'move' | 'delete';

export interface LogicTreeRowProps {
  node: LogicTreeNode;
  depth: number;
  editable: boolean;
  onAction: (node: LogicTreeNode, action: NodeAction) => void;
}

/** One logic-tree node (with its sub-nodes): disclosure, name, code, category and a keyboard-operable menu. */
export function LogicTreeRow({ node, depth, editable, onAction }: LogicTreeRowProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const children = node.children ?? [];
  const Chevron = expanded ? UiIcon.chevronDown : UiIcon.chevronRight;
  return (
    <li>
      <div className="flex min-h-9 items-center gap-2 rounded hover:bg-muted/50" style={{ paddingLeft: depth * 20 }}>
        {children.length > 0 ? (
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.name}`}
            onClick={() => setExpanded((open) => !open)}
          >
            <Chevron className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <span className="w-6" aria-hidden />
        )}
        <span className="min-w-0 truncate text-sm font-medium">{node.name}</span>
        <span className="text-xs text-muted-foreground">{node.code}</span>
        <Badge variant="outline" className="text-xs">
          {node.category}
        </Badge>
        {editable && (
          <span className="ml-auto flex items-center">
            <IconButton icon={ActionIcon.add} label={`Add a sub-node to ${node.name}`} onClick={() => onAction(node, 'addChild')} />
            <IconButton icon={ActionIcon.edit} label={`Edit ${node.name}`} onClick={() => onAction(node, 'edit')} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton icon={ActionIcon.more} label={`More actions for ${node.name}`} tooltip={false} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onAction(node, 'up')}>Move up</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onAction(node, 'down')}>Move down</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onAction(node, 'move')}>Move under…</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onSelect={() => onAction(node, 'delete')}>
                  Delete…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        )}
      </div>
      {expanded && children.length > 0 && (
        <ul>
          {children.map((child) => (
            <LogicTreeRow key={child.id} node={child} depth={depth + 1} editable={editable} onAction={onAction} />
          ))}
        </ul>
      )}
    </li>
  );
}
