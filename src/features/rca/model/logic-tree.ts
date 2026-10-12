import type { RcaEvidenceItem, RcaLogicNode } from '@/api/v2/types/rca';
import { newItemId } from './rca-form';

/** A node with its children, for display (the case stores the flat list). */
export interface TreeNode {
  node: RcaLogicNode;
  children: TreeNode[];
}

/** Builds the tree; a node whose parent is missing becomes a root, so nothing is hidden. */
export function buildTree(nodes: readonly RcaLogicNode[]): TreeNode[] {
  const known = new Set(nodes.map((node) => node.id));
  const byParent = new Map<string | null, RcaLogicNode[]>();
  for (const node of nodes) {
    const parent = node.parentId && known.has(node.parentId) && node.parentId !== node.id ? node.parentId : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), node]);
  }
  const visit = (parent: string | null, seen: Set<string>): TreeNode[] =>
    (byParent.get(parent) ?? [])
      .filter((node) => !seen.has(node.id))
      .map((node) => ({ node, children: visit(node.id, new Set([...seen, node.id])) }));
  return visit(null, new Set());
}

/** The node and everything below it. */
export function subtreeIds(nodes: readonly RcaLogicNode[], id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        grew = true;
      }
    }
  }
  return ids;
}

export const removeSubtree = (nodes: readonly RcaLogicNode[], id: string) => {
  const gone = subtreeIds(nodes, id);
  return nodes.filter((node) => !gone.has(node.id));
};

export const replaceNode = (nodes: readonly RcaLogicNode[], next: RcaLogicNode) =>
  nodes.map((node) => (node.id === next.id ? next : node));

export function newNode(nodes: readonly RcaLogicNode[], parentId: string | null, fields: Partial<RcaLogicNode>): RcaLogicNode {
  return {
    id: newItemId('node', nodes),
    parentId,
    label: '',
    kind: null,
    status: 'open',
    notes: null,
    code: null,
    description: null,
    verified: null,
    ...fields,
  };
}

/** Counts shown above the tree: nodes, verified findings, root causes, evidence linked to a node. */
export function treeCounts(nodes: readonly RcaLogicNode[], evidence: readonly RcaEvidenceItem[]) {
  const ids = new Set(nodes.map((node) => node.id));
  return {
    nodes: nodes.length,
    verified: nodes.filter((node) => node.verified).length,
    rootCauses: nodes.filter((node) => node.kind === 'Cause' || node.kind === 'root_cause').length,
    linkedEvidence: evidence.filter((item) => item.nodeIds.some((id) => ids.has(id))).length,
  };
}

/** Evidence items with the node added or removed (the link lives on the evidence item). */
export function toggleEvidenceLink(evidence: readonly RcaEvidenceItem[], evidenceId: string, nodeId: string, linked: boolean): RcaEvidenceItem[] {
  return evidence.map((item) => {
    if (item.id !== evidenceId) return item;
    const others = item.nodeIds.filter((id) => id !== nodeId);
    return { ...item, nodeIds: linked ? [...others, nodeId] : others };
  });
}
