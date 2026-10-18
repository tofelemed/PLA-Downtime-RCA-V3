import { useState } from 'react';
import type { FaultTreeContent, FaultTreeNode } from '@/api/v2/types/rca-analyses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { rowId } from '../../../../model/analysis-settings';
import { useCaseWorkspace } from '../../../case-context';
import { useToolDraft } from '../tool-draft';
import { SaveBar, ToolFrame, type ToolRecord } from '../tool-record';
import { buildFaultTree } from './fault-tree-model';
import { FaultTreeNodeItem, type FaultTreeActions } from './fault-tree-node-item';
import { TopEventProbability } from './top-event-probability';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

function Editor({ record, save }: { record: ToolRecord<'faultTree'>; save: (body: FaultTreeContent) => Promise<unknown> }) {
  const { rca, readOnly } = useCaseWorkspace();
  const { number } = useNumberFormat();
  const [content, setContent] = useToolDraft<FaultTreeContent>(() => ({ topEvent: record?.topEvent ?? rca.title.slice(0, 255), nodes: record?.nodes ?? [] }));
  const setNodes = (nodes: FaultTreeNode[]) => setContent({ ...content, nodes });
  const [removing, setRemoving] = useState<{ id: string; children: number } | null>(null);
  const removeNow = (id: string) => setNodes(content.nodes.filter((n) => n.id !== id).map((n) => (n.parentId === id ? { ...n, parentId: null } : n)));
  const remove = (id: string) => {
    const children = content.nodes.filter((n) => n.parentId === id).length;
    if (children > 0) setRemoving({ id, children });
    else removeNow(id);
  };
  const add = (parentId: string | null = null) => setNodes([...content.nodes, { id: rowId('node', content.nodes), type: 'BasicEvent', description: '', parentId, probability: null }]);
  const actions: FaultTreeActions = {
    nodes: content.nodes,
    readOnly,
    onChange: (next) => setNodes(content.nodes.map((n) => (n.id === next.id ? next : n))),
    onRemove: remove,
    onAddBelow: (parentId) => add(parentId),
  };
  return (
    <div className="space-y-4" data-testid="fault-tree-tool">
      <div className="space-y-1">
        <Label htmlFor="ft-top">Top event (the undesired outcome)</Label>
        <Input id="ft-top" value={content.topEvent} maxLength={255} disabled={readOnly} onChange={(e) => setContent({ ...content, topEvent: e.target.value })} />
      </div>
      <ul className="space-y-2" aria-label={`Below the top event: ${content.topEvent}`}>
        {buildFaultTree(content.nodes).map((item) => (
          <FaultTreeNodeItem key={item.node.id} item={item} actions={actions} depth={0} />
        ))}
      </ul>
      {!readOnly && (
        <Button type="button" size="sm" variant="outline" onClick={() => add()}>
          Add event or gate under the top event
        </Button>
      )}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title="Remove this node?"
          description={`It has ${number(removing.children)} node(s) below it; they move up to sit directly under the top event. Nothing is saved until you save the fault tree.`}
          confirmLabel="Remove node"
          destructive
          onConfirm={() => removeNow(removing.id)}
        />
      )}
      <TopEventProbability record={record} />
      <SaveBar onSave={() => save(content)} disabled={content.topEvent.trim() === '' || content.nodes.length === 0} hint="Name the top event and add at least one node." label="Save fault tree" updatedAt={record?.updatedAt} />
    </div>
  );
}

/** Fault tree: the top event broken down through AND / OR gates to basic events. */
export function FaultTreeTool() {
  return <ToolFrame tool="faultTree">{(record, save) => <Editor record={record} save={save} />}</ToolFrame>;
}
