import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { useResetRcaLogicTree } from '@/api/v2/queries/rca-commands';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { RcaLogicNode } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { downloadText, exportName } from '../../../../model/case-export';
import { buildTree, newNode, removeSubtree, replaceNode, toggleEvidenceLink, treeCounts } from '../../../../model/logic-tree';
import { useCaseWorkspace } from '../../../case-context';
import { useCasePatch } from '../../../use-case-patch';
import { LogicNodeItem, type LogicTreeActions } from './logic-node-item';
import { NodeDialog, type NodeFields } from './node-dialog';

type Editing = { mode: 'add'; parent: RcaLogicNode | null } | { mode: 'edit'; node: RcaLogicNode } | null;

function ResetToTemplate() {
  const { rca } = useCaseWorkspace();
  const reset = useResetRcaLogicTree();
  const client = useQueryClient();
  const tenantId = useV2TenantId();
  if (!rca.templateId) return null;
  return (
    <ConfirmDialog
      trigger={<Button variant="outline" size="sm">Reset to template</Button>}
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
    <div className="space-y-4" data-testid="logic-tree">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {counts.nodes} node(s) · {counts.verified} verified · {counts.rootCauses} root cause(s) · {counts.linkedEvidence} evidence item(s) linked
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={rca.logicTree.length === 0} onClick={() => downloadText(JSON.stringify(tree, null, 2), exportName(rca, 'logic-tree.json'), 'application/json')}>
            Export
          </Button>
          {!readOnly && <ResetToTemplate />}
          {!readOnly && (
            <Button size="sm" onClick={() => setEditing({ mode: 'add', parent: null })} data-testid="add-root-node">
              Add top-level node
            </Button>
          )}
        </div>
      </div>
      {patch.error ? <FriendlyErrorAlert error={patch.error} /> : null}
      {tree.length === 0 ? (
        <p className="text-sm text-muted-foreground">No nodes yet. Start with the failure you are investigating.</p>
      ) : (
        <ul className="space-y-2">
          {tree.map((item) => (
            <LogicNodeItem key={item.node.id} item={item} actions={actions} depth={0} />
          ))}
        </ul>
      )}
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
