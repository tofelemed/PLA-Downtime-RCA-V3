import { FAILURE_GROUP_KINDS, FailureGroupKind } from './code-library-kind';

/** Separator of the materialised path (ids from the root, spec §14.2 `path`). */
export const PATH_SEPARATOR = '/';

export interface TreeNode {
  id: string;
  path?: string | null;
  level?: number;
}

/** Path of a node: legacy rows without one are roots whose path is their id. */
export function pathOf(node: TreeNode): string {
  return node.path || node.id;
}

/** Path and level of `id` placed under `parent` (or as a root). */
export function placement(
  id: string,
  parent: TreeNode | null,
): { path: string; level: number } {
  if (!parent) return { path: id, level: 0 };
  return {
    path: `${pathOf(parent)}${PATH_SEPARATOR}${id}`,
    level: (parent.level ?? 0) + 1,
  };
}

/**
 * True when moving `nodeId` under `parent` would close a cycle: the parent is the node itself or one of
 * its descendants (the node's id appears in the parent's path).
 */
export function wouldCycle(nodeId: string, parent: TreeNode): boolean {
  return pathOf(parent).split(PATH_SEPARATOR).includes(nodeId);
}

/** Failure groups: a child sits exactly one level below its parent (class → problem → cause → remedy). */
export function isValidFailureParent(
  child: FailureGroupKind,
  parent: FailureGroupKind | null,
): boolean {
  const childLevel = FAILURE_GROUP_KINDS.indexOf(child);
  if (parent === null) return childLevel === 0;
  return FAILURE_GROUP_KINDS.indexOf(parent) === childLevel - 1;
}
