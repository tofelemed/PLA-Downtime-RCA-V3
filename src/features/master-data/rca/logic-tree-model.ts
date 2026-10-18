import type { CauseCategory, LogicTreeNode } from '../api/master-data-types';

export const CAUSE_CATEGORIES: readonly CauseCategory[] = ['Equipment', 'Process', 'Material', 'Personnel', 'Environment', 'Method'];

export interface NodeFields {
  name: string;
  code: string;
  category: CauseCategory;
  description: string;
}

/** A fresh node id (never shown; the server only checks that ids are unique in the tree). */
export function newNodeId(): string {
  return crypto.randomUUID();
}

/** Adds `node` under `parentId` (null = top level), at the end. */
export function addNode(tree: readonly LogicTreeNode[], parentId: string | null, node: LogicTreeNode): LogicTreeNode[] {
  if (parentId === null) return [...tree, node];
  return tree.map((entry) =>
    entry.id === parentId
      ? { ...entry, children: [...(entry.children ?? []), node] }
      : { ...entry, children: addNode(entry.children ?? [], parentId, node) },
  );
}

export function updateNode(tree: readonly LogicTreeNode[], id: string, fields: NodeFields): LogicTreeNode[] {
  return tree.map((entry) =>
    entry.id === id
      ? { ...entry, ...fields, description: fields.description || undefined }
      : { ...entry, children: updateNode(entry.children ?? [], id, fields) },
  );
}

/** Removes a node with its whole subtree. */
export function removeNode(tree: readonly LogicTreeNode[], id: string): LogicTreeNode[] {
  return tree.filter((entry) => entry.id !== id).map((entry) => ({ ...entry, children: removeNode(entry.children ?? [], id) }));
}

/** Moves a node one place up (-1) or down (+1) among its siblings; unchanged at the ends. */
export function moveSibling(tree: readonly LogicTreeNode[], id: string, delta: -1 | 1): LogicTreeNode[] {
  const index = tree.findIndex((entry) => entry.id === id);
  if (index >= 0) {
    const target = index + delta;
    if (target < 0 || target >= tree.length) return [...tree];
    const next = [...tree];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }
  return tree.map((entry) => ({ ...entry, children: moveSibling(entry.children ?? [], id, delta) }));
}

export function findNode(tree: readonly LogicTreeNode[], id: string): LogicTreeNode | null {
  for (const entry of tree) {
    if (entry.id === id) return entry;
    const inner = findNode(entry.children ?? [], id);
    if (inner) return inner;
  }
  return null;
}

/** Moves a node with its subtree under another node (null = top level); refused (unchanged) into its own subtree. */
export function moveUnder(tree: readonly LogicTreeNode[], id: string, parentId: string | null): LogicTreeNode[] {
  const node = findNode(tree, id);
  if (!node || id === parentId) return [...tree];
  if (parentId && findNode(node.children ?? [], parentId)) return [...tree];
  return addNode(removeNode(tree, id), parentId, node);
}

/** Every node as `{ node, depth }` in display order (for the "Move under" choices). */
export function flatten(tree: readonly LogicTreeNode[], depth = 0): Array<{ node: LogicTreeNode; depth: number }> {
  return tree.flatMap((node) => [{ node, depth }, ...flatten(node.children ?? [], depth + 1)]);
}

/** Nodes of an imported tree with the fields the server accepts (ids kept, unknown fields dropped). */
export function sanitizeTree(value: unknown): LogicTreeNode[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): LogicTreeNode[] => {
    if (typeof raw !== 'object' || raw === null) return [];
    const entry = raw as Record<string, unknown>;
    const category = CAUSE_CATEGORIES.includes(entry.category as CauseCategory) ? (entry.category as CauseCategory) : 'Equipment';
    const name = typeof entry.name === 'string' ? entry.name : '';
    const code = typeof entry.code === 'string' ? entry.code : '';
    if (!name.trim() || !code.trim()) return [];
    return [{
      id: typeof entry.id === 'string' && entry.id ? entry.id : newNodeId(),
      name,
      code,
      category,
      ...(typeof entry.description === 'string' && entry.description ? { description: entry.description } : {}),
      children: sanitizeTree(entry.children),
    }];
  });
}

/**
 * The tree as the template DTO accepts it (`LogicTreeNodeDto`): only its fields, at every level. A stored
 * tree read back (v1 or imported templates) can carry other keys, and the server refuses any undeclared
 * property (`forbidNonWhitelisted`), so a save must never echo the read model as is.
 */
export function logicTreeBodyOf(nodes: readonly LogicTreeNode[]): LogicTreeNode[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    code: node.code,
    category: node.category,
    ...(node.description !== undefined ? { description: node.description } : {}),
    ...(node.note !== undefined ? { note: node.note } : {}),
    ...(node.finding !== undefined ? { finding: node.finding } : {}),
    ...(node.children ? { children: logicTreeBodyOf(node.children) } : {}),
  }));
}
