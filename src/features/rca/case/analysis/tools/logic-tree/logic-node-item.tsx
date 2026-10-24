import { useState } from 'react';
import type { RcaEvidenceItem, RcaLogicNode } from '@/api/v2/types/rca';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon, UiIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import type { TreeNode } from '../../../../model/logic-tree';
import { EvidenceLinkPopover } from '../evidence-link-popover';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { plural } from '@/features/ux-kit/format/plural';

export interface LogicTreeActions {
  readOnly: boolean;
  busy: boolean;
  evidence: readonly RcaEvidenceItem[];
  onAddChild: (parent: RcaLogicNode) => void;
  onEdit: (node: RcaLogicNode) => void;
  onDelete: (node: RcaLogicNode) => Promise<unknown>;
  onVerify: (node: RcaLogicNode, verified: boolean) => void;
  onLinkEvidence: (node: RcaLogicNode, evidenceId: string, linked: boolean) => void;
}

const isCauseNode = (node: RcaLogicNode) => node.kind === 'Cause' || node.kind === 'root_cause';

/** Kind, code and root-cause badges; a verified node says so ("Confirmed root cause" for a cause). */
function NodeBadges({ node }: { node: RcaLogicNode }) {
  const isCause = isCauseNode(node);
  return (
    <div className="flex flex-wrap gap-1">
      {node.kind && <Badge variant="secondary" className="whitespace-nowrap">{node.kind}</Badge>}
      {node.code && <Badge variant="outline" className="whitespace-nowrap">{node.code}</Badge>}
      {isCause && !node.verified && <Badge variant="destructive" className="whitespace-nowrap">Root cause</Badge>}
      {node.verified && <Badge className="whitespace-nowrap">{isCause ? 'Confirmed root cause' : 'Verified'}</Badge>}
    </div>
  );
}

/** Evidence link, add below, edit and delete (with its confirm) of one node. */
function NodeTools({ node, actions, childCount }: { node: RcaLogicNode; actions: LogicTreeActions; childCount: number }) {
  const { number } = useNumberFormat();
  const below = `The ${plural(childCount, 'node', 'nodes', number)} below it ${childCount === 1 ? 'is' : 'are'} deleted too.`;
  return (
    <div className="flex items-center gap-1">
      <EvidenceLinkPopover targetId={node.id} targetName={node.label} evidence={actions.evidence} disabled={actions.busy} onToggle={(id, linked) => actions.onLinkEvidence(node, id, linked)} />
      <IconButton icon={ActionIcon.add} label={`Add a node below ${node.label}`} disabled={actions.busy} onClick={() => actions.onAddChild(node)} />
      <IconButton icon={ActionIcon.edit} label={`Edit ${node.label}`} disabled={actions.busy} onClick={() => actions.onEdit(node)} />
      <ConfirmDialog
        trigger={<IconButton icon={ActionIcon.delete} label={`Delete ${node.label}`} tooltip={false} disabled={actions.busy} />}
        title={`Delete "${node.label}"?`}
        description={childCount > 0 ? below : 'The node is removed from the logic tree.'}
        confirmLabel="Delete node"
        destructive
        onConfirm={() => actions.onDelete(node)}
      />
    </div>
  );
}

/** Editable: the verify checkbox. Read-only: a muted "Not verified" (a verified node shows its badge). */
function NodeVerification({ node, actions }: { node: RcaLogicNode; actions: LogicTreeActions }) {
  const verifyId = `verify-${node.id}`;
  if (actions.readOnly) {
    return node.verified ? null : <p className="text-sm text-muted-foreground" data-testid="node-not-verified">Not verified</p>;
  }
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={verifyId} checked={node.verified === true} disabled={actions.busy} onCheckedChange={(value) => actions.onVerify(node, value === true)} />
      <Label htmlFor={verifyId}>{isCauseNode(node) ? 'Confirmed root cause' : 'Verified'}</Label>
    </div>
  );
}

function NodeCard({ node, actions, childCount }: { node: RcaLogicNode; actions: LogicTreeActions; childCount: number }) {
  return (
    <div className="space-y-2 rounded-md border bg-card p-3" data-testid="logic-node">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-medium">{node.label}</p>
          <NodeBadges node={node} />
        </div>
        {!actions.readOnly && <NodeTools node={node} actions={actions} childCount={childCount} />}
      </div>
      {node.description && <p className="max-w-[75ch] text-sm">{node.description}</p>}
      {node.notes && <p className="text-sm text-muted-foreground">Note: {node.notes}</p>}
      <NodeVerification node={node} actions={actions} />
    </div>
  );
}

const countBelow = (item: TreeNode): number => item.children.reduce((sum, child) => sum + 1 + countBelow(child), 0);

/** One node with its subtree; subtrees start expanded and can be folded. */
export function LogicNodeItem({ item, actions, depth }: { item: TreeNode; actions: LogicTreeActions; depth: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = item.children.length > 0;
  return (
    <li className={cn('space-y-2', depth > 0 && 'border-l pl-4')}>
      <div className="flex items-start gap-1">
        {hasChildren ? (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-expanded={open} aria-label={`${open ? 'Fold' : 'Unfold'} ${item.node.label}`} onClick={() => setOpen(!open)}>
            <UiIcon.chevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
          </Button>
        ) : (
          <span className="w-7 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <NodeCard node={item.node} actions={actions} childCount={countBelow(item)} />
        </div>
      </div>
      {hasChildren && open && (
        <ul className="ml-8 space-y-2">
          {item.children.map((child) => (
            <LogicNodeItem key={child.node.id} item={child} actions={actions} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
