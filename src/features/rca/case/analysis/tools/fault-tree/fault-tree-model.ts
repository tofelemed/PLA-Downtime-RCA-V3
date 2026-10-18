import type { FaultTreeNode } from '@/api/v2/types/rca-analyses';

/** A fault-tree node with its position in the stored list (labels keep that number) and its children. */
export interface FaultTreeItem {
  node: FaultTreeNode;
  index: number;
  children: FaultTreeItem[];
}

/**
 * The stored flat list as a tree for display (F-10); a node whose parent is missing, itself or part of a
 * loop sits at the top, so nothing is hidden. The list and its save stay as they are.
 */
export function buildFaultTree(nodes: readonly FaultTreeNode[]): FaultTreeItem[] {
  const known = new Set(nodes.map((node) => node.id));
  const byParent = new Map<string | null, Array<{ node: FaultTreeNode; index: number }>>();
  nodes.forEach((node, index) => {
    const parent = node.parentId && known.has(node.parentId) && node.parentId !== node.id ? node.parentId : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), { node, index }]);
  });
  const placed = new Set<string>();
  const visit = (parent: string | null): FaultTreeItem[] => {
    const items: FaultTreeItem[] = [];
    for (const entry of byParent.get(parent) ?? []) {
      if (placed.has(entry.node.id)) continue;
      placed.add(entry.node.id);
      items.push({ ...entry, children: visit(entry.node.id) });
    }
    return items;
  };
  const tree = visit(null);
  const orphans = nodes.map((node, index) => ({ node, index })).filter(({ node }) => !placed.has(node.id));
  return [...tree, ...orphans.map(({ node, index }) => ({ node, index, children: [] }))];
}

/** The node and every node below it (a node cannot move under one of these). */
export function faultSubtreeIds(nodes: readonly FaultTreeNode[], id: string): Set<string> {
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
