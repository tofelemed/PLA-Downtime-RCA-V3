import { useState } from 'react';
import type { FaultTreeNode } from '@/api/v2/types/rca-analyses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/features/ux-kit/form-field';
import { IconButton } from '@/features/ux-kit/icon-button';
import { RCA_FAULT_TREE_NODE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionIcon, UiIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { FAULT_TREE_TYPES } from '../../../../model/analysis-settings';
import { ReadField, ToolChoiceField, ToolTextField } from '../tool-fields';
import { faultSubtreeIds, type FaultTreeItem } from './fault-tree-model';

const TYPE_OPTIONS = FAULT_TREE_TYPES.map((type) => ({ value: type, label: RCA_FAULT_TREE_NODE_LABELS[type] }));

export interface FaultTreeActions {
  nodes: readonly FaultTreeNode[];
  readOnly: boolean;
  onChange: (next: FaultTreeNode) => void;
  onRemove: (id: string) => void;
  onAddBelow: (parentId: string) => void;
}

const nameOf = (node: FaultTreeNode, index: number) => node.description || `Node ${index + 1}`;

function probabilityOf(text: string): number | null {
  const value = Number.parseFloat(text);
  return text === '' || Number.isNaN(value) ? null : Math.min(1, Math.max(0, value));
}

function ProbabilityField({ node, index, readOnly, onChange }: { node: FaultTreeNode; index: number; readOnly: boolean; onChange: (probability: number | null) => void }) {
  const { text } = useNumberFormat();
  const hasProbability = node.type === 'BasicEvent' || node.type === 'Event';
  const label = 'Probability (0–1)';
  if (readOnly) return <ReadField label={label} value={hasProbability && node.probability !== null ? text(String(node.probability)) : hasProbability ? '' : 'Not used for this kind'} />;
  return (
    <FormField id={`ft-prob-${index}`} label={label} hint={hasProbability ? undefined : 'Basic and intermediate events only'}>
      <Input id={`ft-prob-${index}`} className="h-9" inputMode="decimal" disabled={!hasProbability} value={node.probability === null ? '' : String(node.probability)} onChange={(e) => onChange(probabilityOf(e.target.value))} />
    </FormField>
  );
}

function NodeFields({ item, actions }: { item: FaultTreeItem; actions: FaultTreeActions }) {
  const { number } = useNumberFormat();
  const { node, index } = item;
  const below = faultSubtreeIds(actions.nodes, node.id);
  const parents = actions.nodes.map((other, at) => ({ value: other.id, label: nameOf(other, at) })).filter((option) => !below.has(option.value));
  const set = (patch: Partial<FaultTreeNode>) => actions.onChange({ ...node, ...patch });
  return (
    <div className="grid gap-2 rounded-md border bg-card p-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]" data-testid="fault-tree-node">
      <ToolTextField id={`ft-desc-${index}`} label={`Event or gate ${number(index + 1)}`} value={node.description} maxLength={1000} onChange={(description) => set({ description })} />
      <ToolChoiceField id={`ft-type-${index}`} label="Kind" value={node.type} options={TYPE_OPTIONS} onChange={(type) => set({ type })} />
      <ToolChoiceField
        id={`ft-parent-${index}`}
        label={actions.readOnly ? 'Under' : 'Move under'}
        value={node.parentId ?? ''}
        options={parents}
        allowNone="Top event"
        onChange={(parentId) => set({ parentId: parentId || null })}
      />
      <ProbabilityField node={node} index={index} readOnly={actions.readOnly} onChange={(probability) => set({ probability })} />
      {!actions.readOnly && (
        <div className="flex items-end gap-1">
          <IconButton icon={ActionIcon.add} label={`Add a node below ${nameOf(node, index)}`} onClick={() => actions.onAddBelow(node.id)} />
          <IconButton icon={ActionIcon.delete} label={`Remove node ${index + 1}`} onClick={() => actions.onRemove(node.id)} />
        </div>
      )}
    </div>
  );
}

/** F-10: one fault-tree node with its subtree, indented like the logic tree; subtrees can be folded. */
export function FaultTreeNodeItem({ item, actions, depth }: { item: FaultTreeItem; actions: FaultTreeActions; depth: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = item.children.length > 0;
  const name = nameOf(item.node, item.index);
  return (
    <li className={cn('space-y-2', depth > 0 && 'border-l pl-4')}>
      <div className="flex items-start gap-1">
        {hasChildren ? (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-expanded={open} aria-label={`${open ? 'Fold' : 'Unfold'} ${name}`} onClick={() => setOpen(!open)}>
            <UiIcon.chevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
          </Button>
        ) : (
          <span className="w-7 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <NodeFields item={item} actions={actions} />
        </div>
      </div>
      {hasChildren && open && (
        <ul className="ml-8 space-y-2" aria-label={`Below ${name}`}>
          {item.children.map((child) => (
            <FaultTreeNodeItem key={child.node.id} item={child} actions={actions} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
