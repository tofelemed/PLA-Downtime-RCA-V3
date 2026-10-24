import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { useResetRcaLogicTree } from '@/api/v2/queries/rca-commands';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { RcaLogicNode } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { ActionIcon } from '@/lib/icons';
import { downloadText, exportName } from '../../../../model/case-export';
import { buildTree, newNode, removeSubtree, replaceNode, toggleEvidenceLink, treeCounts, type TreeNode } from '../../../../model/logic-tree';
import { useCaseWorkspace } from '../../../case-context';
import { useCasePatch } from '../../../use-case-patch';
import { ToolCanvas } from '../tool-canvas';
import { LogicNodeItem, type LogicTreeActions } from './logic-node-item';
import { NodeDialog, type NodeFields } from './node-dialog';
import { plural } from '@/features/ux-kit/format/plural';

type Editing = { mode: 'add'; parent: RcaLogicNode | null } | { mode: 'edit'; node: RcaLogicNode } | null;

function ResetToTemplate() {
  const { rca } = useCaseWorkspace();
  const reset = useResetRcaLogicTree();
  const client = useQueryClient();
  const tenantId = useV2TenantId();
  if (!rca.templateId) return null;
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" className="h-9">
          <ActionIcon.reset aria-hidden="true" className="h-4 w-4" />
          Reset to template
        </Button>
      }
      title="Reset the logic tree to its template?"
      description="Every node is replaced by a fresh copy of the template's tree; evidence links to the old nodes no longer show."
      confirmLabel="Reset logic tree"
      destructive
      onConfirm={async () => {
        const result = await reset.submit(rca);
        client.setQueryData(v2Keys.detail(tenantId ?? '-', 'rca-cases', rca.id, undefined), result);
      }}
    >
      {reset.error ? <FriendlyErrorAlert error={reset.error} /> : null}
    </ConfirmDialog>
  );
}

function useTreeActions(setEditing: (editing: Editing) => void): LogicTreeActions {
  const { rca, readOnly } = useCaseWorkspace();
  const patch = useCasePatch();
  const saveTree = (logicTree: RcaLogicNode[]) => patch.save({ logicTree });
  return {
    readOnly,
    busy: patch.isPending,
    evidence: rca.evidence,
    onAddChild: (parent) => setEditing({ mode: 'add', parent }),
    onEdit: (node) => setEditing({ mode: 'edit', node }),
    onDelete: (node) => saveTree(removeSubtree(rca.logicTree, node.id)),
    onVerify: (node, verified) => void saveTree(replaceNode(rca.logicTree, { ...node, verified })).catch(() => null),
    onLinkEvidence: (node, evidenceId, linked) => void patch.save({ evidence: toggleEvidenceLink(rca.evidence, evidenceId, node.id, linked) }).catch(() => null),
  };
}

/** Add / reset (editable case only) and export of the logic tree. */
function Toolbar({ tree, onAdd }: { tree: TreeNode[]; onAdd: () => void }) {
  const { rca, readOnly } = useCaseWorkspace();
  return (
    <>
      {!readOnly && (
        <Button className="h-9" onClick={onAdd} data-testid="add-root-node">
          <ActionIcon.add aria-hidden="true" className="h-4 w-4" />
          Add top-level node
        </Button>
      )}
      {!readOnly && <ResetToTemplate />}
      <Button variant="outline" className="h-9" disabled={rca.logicTree.length === 0} onClick={() => downloadText(JSON.stringify(tree, null, 2), exportName(rca, 'logic-tree.json'), 'application/json')}>
        <ActionIcon.export aria-hidden="true" className="h-4 w-4" />
        Export
      </Button>
    </>
  );
}

/** Logic tree: failure → modes → hypotheses → verified causes, each change saved with the case. */
export function LogicTreeTool() {
  const { rca, readOnly } = useCaseWorkspace();
  const patch = useCasePatch();
  const [editing, setEditing] = useState<Editing>(null);
  const actions = useTreeActions(setEditing);
  const tree = useMemo(() => buildTree(rca.logicTree), [rca.logicTree]);
  const counts = treeCounts(rca.logicTree, rca.evidence);
  const save = async (fields: NodeFields) => {
    const next =
      editing?.mode === 'edit'
        ? replaceNode(rca.logicTree, { ...editing.node, ...fields })
        : [...rca.logicTree, newNode(rca.logicTree, editing?.mode === 'add' ? (editing.parent?.id ?? null) : null, fields)];
    if (await patch.save({ logicTree: next }).catch(() => null)) setEditing(null);
  };
  return (
    <div className="space-y-3" data-testid="logic-tree">
      <p className="text-sm text-muted-foreground" data-testid="logic-tree-counts">
        {plural(counts.nodes, 'node', 'nodes')} · {counts.verified} verified · {plural(counts.rootCauses, 'root cause', 'root causes')} · {plural(counts.linkedEvidence, 'evidence item', 'evidence items')} linked
      </p>
      {patch.error ? <FriendlyErrorAlert error={patch.error} /> : null}
      <ToolCanvas
        label="Logic tree"
        toolbar={<Toolbar tree={tree} onAdd={() => setEditing({ mode: 'add', parent: null })} />}
      >
        {tree.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{readOnly ? 'No nodes recorded.' : 'No nodes yet. Start with the failure you are investigating.'}</p>
        ) : (
          <ul className="space-y-2">
            {tree.map((item) => (
              <LogicNodeItem key={item.node.id} item={item} actions={actions} depth={0} />
            ))}
          </ul>
        )}
      </ToolCanvas>
      {editing && (
        <NodeDialog
          title={editing.mode === 'edit' ? `Edit "${editing.node.label}"` : editing.parent ? `Add a node below "${editing.parent.label}"` : 'Add a top-level node'}
          initial={editing.mode === 'edit' ? editing.node : undefined}
          onSave={(fields) => void save(fields)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
