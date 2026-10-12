import { useState } from 'react';
import type { FaultTreeContent, FaultTreeNode } from '@/api/v2/types/rca-analyses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconButton } from '@/features/ux-kit/icon-button';
import { RCA_FAULT_TREE_NODE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { ActionIcon } from '@/lib/icons';
import { FAULT_TREE_TYPES, rowId } from '../../../../model/analysis-settings';
import { useCaseWorkspace } from '../../../case-context';
import { ChoiceField } from '../../../evidence/form-controls';
import { SaveBar, ToolFrame, type ToolRecord } from '../tool-record';

const TYPE_OPTIONS = FAULT_TREE_TYPES.map((type) => ({ value: type, label: RCA_FAULT_TREE_NODE_LABELS[type] }));

function NodeRow(props: { node: FaultTreeNode; index: number; nodes: FaultTreeNode[]; readOnly: boolean; onChange: (next: FaultTreeNode) => void; onRemove: () => void }) {
  const { node, index, readOnly } = props;
  const parents = props.nodes.filter((other) => other.id !== node.id).map((other, at) => ({ value: other.id, label: other.description || `Node ${at + 1}` }));
  const hasProbability = node.type === 'BasicEvent' || node.type === 'Event';
  return (
    <li className="grid gap-2 rounded border p-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]" data-testid="fault-tree-node">
      <div className="space-y-1">
        <Label htmlFor={`ft-desc-${index}`}>Event or gate {index + 1}</Label>
        <Input id={`ft-desc-${index}`} value={node.description} maxLength={1000} disabled={readOnly} onChange={(e) => props.onChange({ ...node, description: e.target.value })} />
      </div>
      <ChoiceField id={`ft-type-${index}`} label="Kind" value={node.type} options={TYPE_OPTIONS} onChange={(type) => props.onChange({ ...node, type })} />
      <ChoiceField id={`ft-parent-${index}`} label="Below" value={node.parentId ?? ''} options={parents} allowNone="Top event" onChange={(parentId) => props.onChange({ ...node, parentId: parentId || null })} />
      <div className="space-y-1">
        <Label htmlFor={`ft-prob-${index}`}>Probability (0–1)</Label>
        <Input
          id={`ft-prob-${index}`}
          inputMode="decimal"
          disabled={readOnly || !hasProbability}
          value={node.probability === null ? '' : String(node.probability)}
          onChange={(e) => {
            const value = Number.parseFloat(e.target.value);
            props.onChange({ ...node, probability: e.target.value === '' || Number.isNaN(value) ? null : Math.min(1, Math.max(0, value)) });
          }}
        />
      </div>
      {!readOnly && <IconButton icon={ActionIcon.delete} label={`Remove node ${index + 1}`} className="self-end" onClick={props.onRemove} />}
    </li>
  );
}

function Editor({ record, save }: { record: ToolRecord<'faultTree'>; save: (body: FaultTreeContent) => Promise<unknown> }) {
  const { rca, readOnly } = useCaseWorkspace();
  const [content, setContent] = useState<FaultTreeContent>(() => ({ topEvent: record?.topEvent ?? rca.title.slice(0, 255), nodes: record?.nodes ?? [] }));
  const setNodes = (nodes: FaultTreeNode[]) => setContent({ ...content, nodes });
  const remove = (id: string) => setNodes(content.nodes.filter((n) => n.id !== id).map((n) => (n.parentId === id ? { ...n, parentId: null } : n)));
  const add = () => setNodes([...content.nodes, { id: rowId('node', content.nodes), type: 'BasicEvent', description: '', parentId: null, probability: null }]);
  return (
    <div className="space-y-4" data-testid="fault-tree-tool">
      <div className="space-y-1">
        <Label htmlFor="ft-top">Top event (the undesired outcome)</Label>
        <Input id="ft-top" value={content.topEvent} maxLength={255} disabled={readOnly} onChange={(e) => setContent({ ...content, topEvent: e.target.value })} />
      </div>
      <ul className="space-y-2">
        {content.nodes.map((node, index) => (
          <NodeRow key={node.id} node={node} index={index} nodes={content.nodes} readOnly={readOnly} onChange={(next) => setNodes(content.nodes.map((n) => (n.id === next.id ? next : n)))} onRemove={() => remove(node.id)} />
        ))}
      </ul>
      {!readOnly && (
        <Button type="button" size="sm" variant="outline" onClick={add}>
          Add event or gate
        </Button>
      )}
      <SaveBar onSave={() => save(content)} disabled={content.topEvent.trim() === '' || content.nodes.length === 0} hint="Name the top event and add at least one node." label="Save fault tree" updatedAt={record?.updatedAt} />
    </div>
  );
}

/** Fault tree: the top event broken down through AND / OR gates to basic events. */
export function FaultTreeTool() {
  return <ToolFrame tool="faultTree">{(record, save) => <Editor record={record} save={save} />}</ToolFrame>;
}
