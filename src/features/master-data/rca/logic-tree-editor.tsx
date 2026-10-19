import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { ActionIcon } from '@/lib/icons';
import type { LogicTreeNode } from '../api/master-data-types';
import { LogicTreeRow, type NodeAction } from './logic-tree-row';
import { addNode, findNode, flatten, moveSibling, moveUnder, newNodeId, removeNode, updateNode, type NodeFields } from './logic-tree-model';
import { MoveNodeDialog } from './move-node-dialog';
import { NodeDialog } from './node-dialog';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { plural } from '@/features/ux-kit/format/plural';

type Pending = { kind: 'add'; parent: LogicTreeNode | null } | { kind: 'edit' | 'move' | 'delete'; node: LogicTreeNode };

const EMPTY: NodeFields = { name: '', code: '', category: 'Equipment', description: '' };

export interface LogicTreeEditorProps {
  tree: LogicTreeNode[];
  onChange: (tree: LogicTreeNode[]) => void;
  editable: boolean;
}

function parentIdOf(tree: readonly LogicTreeNode[], id: string): string | null {
  return flatten(tree).find((entry) => (entry.node.children ?? []).some((child) => child.id === id))?.node.id ?? null;
}

/**
 * The logic tree of a template: add, edit, reorder, move under another node and delete (confirmed) — all
 * with buttons and menus (keyboard operable), node forms in Radix dialogs. Changes are saved with the template.
 */
export function LogicTreeEditor({ tree, onChange, editable }: LogicTreeEditorProps) {
  const { number } = useNumberFormat();
  const [pending, setPending] = useState<Pending | null>(null);
  const close = () => setPending(null);
  const codesExcept = (id: string | null) =>
    new Set(flatten(tree).filter((entry) => entry.node.id !== id).map((entry) => entry.node.code.toLowerCase()));
  const onAction = (node: LogicTreeNode, action: NodeAction) => {
    if (action === 'up' || action === 'down') return onChange(moveSibling(tree, node.id, action === 'up' ? -1 : 1));
    if (action === 'addChild') return setPending({ kind: 'add', parent: node });
    setPending({ kind: action, node });
  };
  return (
    <div className="space-y-3">
      {tree.length === 0 ? (
        <p className="text-sm text-muted-foreground">The tree is empty. Add a top-level node to start.</p>
      ) : (
        <ul aria-label="Logic tree" className="rounded-md border p-2">
          {tree.map((node) => (
            <LogicTreeRow key={node.id} node={node} depth={0} editable={editable} onAction={onAction} />
          ))}
        </ul>
      )}
      {editable && (
        <Button type="button" variant="outline" size="sm" onClick={() => setPending({ kind: 'add', parent: null })}>
          <ActionIcon.add aria-hidden="true" className="mr-2 h-4 w-4" />
          Add top-level node
        </Button>
      )}
      {pending?.kind === 'add' && (
        <NodeDialog
          title={pending.parent ? `Add a sub-node to ${pending.parent.name}` : 'Add top-level node'}
          initial={EMPTY}
          takenCodes={codesExcept(null)}
          onSubmit={(fields) => onChange(addNode(tree, pending.parent?.id ?? null, { ...fields, id: newNodeId(), description: fields.description || undefined, children: [] }))}
          onClose={close}
        />
      )}
      {pending?.kind === 'edit' && (
        <NodeDialog
          title={`Edit ${pending.node.name}`}
          initial={{ name: pending.node.name, code: pending.node.code, category: pending.node.category, description: pending.node.description ?? '' }}
          takenCodes={codesExcept(pending.node.id)}
          onSubmit={(fields) => onChange(updateNode(tree, pending.node.id, fields))}
          onClose={close}
        />
      )}
      {pending?.kind === 'move' && (
        <MoveNodeDialog
          name={pending.node.name}
          currentParentId={parentIdOf(tree, pending.node.id)}
          targets={flatten(tree)
            .filter((entry) => entry.node.id !== pending.node.id && !findNode(pending.node.children ?? [], entry.node.id))
            .map((entry) => ({ id: entry.node.id, label: `${'— '.repeat(entry.depth)}${entry.node.name} (${entry.node.code})` }))}
          onMove={(parentId) => onChange(moveUnder(tree, pending.node.id, parentId))}
          onClose={close}
        />
      )}
      {pending?.kind === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && close()}
          title={`Delete ${pending.node.name}?`}
          description={`It is removed with its ${plural(flatten(pending.node.children ?? []).length, 'sub-node', 'sub-nodes', number)} when you save the template.`}
          confirmLabel="Delete node"
          destructive
          onConfirm={() => onChange(removeNode(tree, pending.node.id))}
        />
      )}
    </div>
  );
}
