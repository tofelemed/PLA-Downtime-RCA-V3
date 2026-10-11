import { useState } from 'react';
import type { RcaLogicNode } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { newItemId } from '../model/rca-form';

const NO_PARENT = '';

function depthOf(node: RcaLogicNode, byId: Map<string, RcaLogicNode>): number {
  let depth = 0;
  let parent = node.parentId ? byId.get(node.parentId) : undefined;
  while (parent && depth < 20) {
    depth += 1;
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return depth;
}

/** Logic tree (failure → modes → hypotheses → causes) as an indented list; persisted with the case. */
export function LogicTreeEditor({ nodes, onChange, readOnly = false }: { nodes: RcaLogicNode[]; onChange: (nodes: RcaLogicNode[]) => void; readOnly?: boolean }) {
  const [label, setLabel] = useState('');
  const [parentId, setParentId] = useState(NO_PARENT);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const add = () => {
    onChange([...nodes, { id: newItemId('node', nodes), parentId: parentId || null, label: label.trim(), kind: null, status: 'open', notes: null }]);
    setLabel('');
  };
  const remove = (id: string) => onChange(nodes.filter((node) => node.id !== id && node.parentId !== id));
  return (
    <fieldset className="space-y-2 rounded border p-2" data-testid="logic-tree">
      <legend className="px-1 text-sm font-medium">Logic tree</legend>
      <ul className="space-y-1 text-sm">
        {nodes.map((node) => (
          <li key={node.id} className="flex items-center justify-between" style={{ paddingLeft: `${depthOf(node, byId) * 1.25}rem` }}>
            <span>{node.label}{node.status ? <span className="text-muted-foreground"> · {node.status}</span> : null}</span>
            {!readOnly && <Button size="sm" variant="ghost" aria-label={`Remove ${node.label}`} onClick={() => remove(node.id)}>Remove</Button>}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Node" aria-label="Logic tree node" value={label} maxLength={500} onChange={(e) => setLabel(e.target.value)} />
          <select className="rounded border px-2 text-sm" aria-label="Parent node" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value={NO_PARENT}>Top level</option>
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>{node.label}</option>
            ))}
          </select>
          <Button size="sm" variant="outline" disabled={label.trim() === ''} onClick={add}>Add node</Button>
        </div>
      )}
    </fieldset>
  );
}
