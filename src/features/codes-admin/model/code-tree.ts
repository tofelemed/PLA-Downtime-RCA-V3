import type { CodeDetailView, FailureGroupKind } from '@/api/v2/types/codes-admin';

/** One row of the code tree (display only; the server owns paths, levels and cycle checks). */
export interface CodeTreeRow {
  code: CodeDetailView;
  depth: number;
  hasChildren: boolean;
}

const FAILURE_LEVELS: readonly FailureGroupKind[] = ['class', 'problem', 'cause', 'remedy'];

const byCode = (a: CodeDetailView, b: CodeDetailView) => a.code.localeCompare(b.code);

/** Children per parent id; a code whose parent is not in the list is shown as a root. */
function childrenIndex(codes: readonly CodeDetailView[]): Map<string | null, CodeDetailView[]> {
  const ids = new Set(codes.map((code) => code.id));
  const index = new Map<string | null, CodeDetailView[]>();
  for (const code of codes) {
    const parent = code.parentId && ids.has(code.parentId) ? code.parentId : null;
    index.set(parent, [...(index.get(parent) ?? []), code]);
  }
  index.forEach((list) => list.sort(byCode));
  return index;
}

/** Depth-first rows of the tree, children under their parent, collapsed subtrees hidden. */
export function treeRows(codes: readonly CodeDetailView[], collapsed: ReadonlySet<string> = new Set()): CodeTreeRow[] {
  const index = childrenIndex(codes);
  const rows: CodeTreeRow[] = [];
  const visit = (parent: string | null, depth: number) => {
    for (const code of index.get(parent) ?? []) {
      const hasChildren = (index.get(code.id) ?? []).length > 0;
      rows.push({ code, depth, hasChildren });
      if (hasChildren && !collapsed.has(code.id)) visit(code.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

/** The code and every code below it. */
export function subtreeIds(codes: readonly CodeDetailView[], id: string): Set<string> {
  const index = childrenIndex(codes);
  const found = new Set<string>([id]);
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const child of index.get(current) ?? []) {
      if (found.has(child.id)) continue;
      found.add(child.id);
      stack.push(child.id);
    }
  }
  return found;
}

/** Whether `parent` may hold `child` by failure level (class → problem → cause → remedy). */
export function failureLevelFits(child: FailureGroupKind | undefined, parent: FailureGroupKind | undefined | null): boolean {
  if (!child) return true;
  const level = FAILURE_LEVELS.indexOf(child);
  if (!parent) return level === 0;
  return FAILURE_LEVELS.indexOf(parent) === level - 1;
}

/**
 * Parents offered when moving a code: active codes outside its own subtree (and, for failure groups,
 * one level up). A guard for the picker only — the server answers 422 CODE_CYCLE / INVALID_REFERENCE.
 */
export function moveTargets(codes: readonly CodeDetailView[], id: string): CodeDetailView[] {
  const moving = codes.find((code) => code.id === id);
  if (!moving) return [];
  const blocked = subtreeIds(codes, id);
  return codes
    .filter((code) => code.active && !blocked.has(code.id) && code.id !== moving.parentId)
    .filter((code) => failureLevelFits(moving.groupKind, code.groupKind))
    .sort(byCode);
}

/** Whether a drop of `draggedId` on `targetId` (null = make root) is worth sending to the server. */
export function canDrop(codes: readonly CodeDetailView[], draggedId: string, targetId: string | null): boolean {
  const moving = codes.find((code) => code.id === draggedId);
  if (!moving || moving.parentId === targetId) return false;
  if (targetId === null) return failureLevelFits(moving.groupKind, null);
  return moveTargets(codes, draggedId).some((code) => code.id === targetId);
}

/** "Mechanical › Bearings": the names above a code (search results), nearest last; "" for a top-level code. */
export function ancestorsLabel(codes: readonly CodeDetailView[], code: CodeDetailView): string {
  const byId = new Map(codes.map((entry) => [entry.id, entry]));
  const names: string[] = [];
  const seen = new Set<string>([code.id]);
  let parent = code.parentId ? byId.get(code.parentId) : undefined;
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    names.unshift(parent.name);
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return names.join(' › ');
}

/** Codes whose code or name contains the search text (case-insensitive), sorted by code. */
export function searchCodes(codes: readonly CodeDetailView[], text: string): CodeDetailView[] {
  const needle = text.trim().toLowerCase();
  if (needle === '') return [];
  return codes
    .filter((code) => code.code.toLowerCase().includes(needle) || code.name.toLowerCase().includes(needle))
    .sort(byCode);
}

/** Whether a code can hold sub-codes (failure groups stop at the remedy level). */
export const canHaveChildren = (code: CodeDetailView): boolean => code.groupKind !== 'remedy';
