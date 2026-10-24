import { useState } from 'react';
import type { FaultTreeContent, FaultTreeNode } from '@/api/v2/types/rca-analyses';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { ActionIcon } from '@/lib/icons';
import { rowId } from '../../../../model/analysis-settings';
import { useCaseWorkspace } from '../../../case-context';
import { ToolCanvas } from '../tool-canvas';
import { useToolDraft } from '../tool-draft';
import { ToolTextField } from '../tool-fields';
import { SaveBar, ToolFrame, type ToolRecord } from '../tool-record';
import { buildFaultTree } from './fault-tree-model';
import { FaultTreeNodeItem, type FaultTreeActions } from './fault-tree-node-item';
import { TopEventProbability } from './top-event-probability';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { plural } from '@/features/ux-kit/format/plural';

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
      <ToolTextField id="ft-top" label="Top event (the undesired outcome)" value={content.topEvent} maxLength={255} onChange={(topEvent) => setContent({ ...content, topEvent })} />
      <ToolCanvas
        label="Fault tree"
        toolbar={
          readOnly ? undefined : (
            <Button type="button" variant="outline" className="h-9" onClick={() => add()}>
              <ActionIcon.add aria-hidden="true" className="h-4 w-4" />
              Add event or gate under the top event
            </Button>
          )
        }
      >
        {content.nodes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No events or gates yet.</p>
        ) : (
          <ul className="space-y-2" aria-label={`Below the top event: ${content.topEvent}`}>
            {buildFaultTree(content.nodes).map((item) => (
              <FaultTreeNodeItem key={item.node.id} item={item} actions={actions} depth={0} />
            ))}
          </ul>
        )}
      </ToolCanvas>
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title="Remove this node?"
          description={`It has ${plural(removing.children, 'node', 'nodes', number)} below it; they move up to sit directly under the top event. Nothing is saved until you save the fault tree.`}
          confirmLabel="Remove node"
          destructive
          onConfirm={() => removeNow(removing.id)}
        />
      )}
      <TopEventProbability record={record} />
      <div className="border-t pt-3">
        <SaveBar onSave={() => save(content)} disabled={content.topEvent.trim() === '' || content.nodes.length === 0} hint="Name the top event and add at least one node." label="Save fault tree" updatedAt={record?.updatedAt} />
      </div>
    </div>
  );
}

/** Fault tree: the top event broken down through AND / OR gates to basic events. */
export function FaultTreeTool() {
  return <ToolFrame tool="faultTree">{(record, save) => <Editor record={record} save={save} />}</ToolFrame>;
}
