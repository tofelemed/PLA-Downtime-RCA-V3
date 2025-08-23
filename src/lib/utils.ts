import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- RCA Logic Tree Conversion Helpers ---
import type { LogicTreeNode as UILogicTreeNode } from '../components/rca-settings/LogicTreeBuilder';
import type { LogicTreeNode as FlatLogicTreeNode } from '../services/MasterDataService';

/**
 * Flattens a UILogicTreeNode tree to a flat array of LogicTreeNode for persistence.
 * @param tree The UI tree (with children)
 * @param rcaId The RCA ID to assign
 * @param tenantId The tenant ID to assign
 * @param parentId The parent node ID (for recursion)
 */
export function treeToFlatList(tree: UILogicTreeNode[] | unknown, rcaId: string, tenantId: string, parentId?: string): FlatLogicTreeNode[] {
  const nodes: UILogicTreeNode[] = tree as UILogicTreeNode[];
  let result: FlatLogicTreeNode[] = [];
  const now = new Date().toISOString();
  for (const node of nodes) {
    const flatNode: any = {
      id: node.id,
      rcaId,
      parentId,
      question: node.name,
      answer: node.description,
      type: node.category,
      code: node.code,
      note: node.note,
      finding: node.finding,
      createdAt: now,
      updatedAt: now,
      tenantId,
    };
    result.push(flatNode);
    if (node.children && node.children.length > 0) {
      result = result.concat(treeToFlatList(node.children, rcaId, tenantId, node.id));
    }
  }
  // Debug: log the flat list after flattening
  if (!parentId) {
    console.log('treeToFlatList result:', JSON.stringify(result, null, 2));
  }
  return result;
}

/**
 * Reconstructs a UILogicTreeNode tree from a flat array of LogicTreeNode.
 * @param flatList The flat list from persistence
 */
export function flatListToTree(flatList: FlatLogicTreeNode[] | unknown): UILogicTreeNode[] {
  const nodes: FlatLogicTreeNode[] = flatList as FlatLogicTreeNode[];
  const idToNode: Record<string, UILogicTreeNode & { children: UILogicTreeNode[] }> = {};
  const roots: UILogicTreeNode[] = [];
  for (const node of nodes) {
    idToNode[node.id] = {
      id: node.id,
      name: node.question || '',
      code: (node as any).code || '',
      category: node.type || '',
      description: node.answer || '',
      note: (node as any).note || '',
      finding: (node as any).finding || false,
      children: [],
    };
  }
  for (const node of nodes) {
    if (node.parentId && idToNode[node.parentId]) {
      idToNode[node.parentId].children.push(idToNode[node.id]);
    } else {
      roots.push(idToNode[node.id]);
    }
  }
  // Debug: log the reconstructed tree
 // console.log('flatListToTree result:', JSON.stringify(roots, null, 2));
  return roots;
}
