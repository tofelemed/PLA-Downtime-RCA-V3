export interface PickableCode {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  path: string;
  active: boolean;
}

/** One row of the picker tree: a group (has active children, not selectable) or a leaf cause. */
export interface ReasonTreeRow {
  id: string;
  code: string;
  name: string;
  /** depth in the tree (0 = root), for the indentation */
  depth: number;
  selectable: boolean;
}

interface Tree {
  roots: PickableCode[];
  children: ReadonlyMap<string, PickableCode[]>;
}

const byCode = (a: PickableCode, b: PickableCode) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id);

/** The active codes as a tree; a code whose parent is not active is shown as a root. */
function treeOf(codes: readonly PickableCode[]): Tree {
  const active = codes.filter((c) => c.active);
  const ids = new Set(active.map((c) => c.id));
  const children = new Map<string, PickableCode[]>();
  const roots: PickableCode[] = [];
  for (const c of active) {
    if (!c.parentId || !ids.has(c.parentId) || c.parentId === c.id) roots.push(c);
    else children.set(c.parentId, [...(children.get(c.parentId) ?? []), c]);
  }
  for (const list of children.values()) list.sort(byCode);
  return { roots: roots.sort(byCode), children };
}

const matches = (c: PickableCode, needle: string) => c.code.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle);

/**
 * FE-04: what a reason picker offers — the active codes as a tree ordered by code, groups (a code with
 * active children is a group, not a cause) as headings and leaf codes selectable. A case-insensitive
 * search over code and name keeps a matching leaf, every leaf under a matching group, and their groups.
 */
export function reasonTreeRows(codes: readonly PickableCode[], query: string): ReasonTreeRow[] {
  const tree = treeOf(codes);
  const needle = query.trim().toLowerCase();
  const seen = new Set<string>();
  // `inherited`: an ancestor matched the search, so its whole subtree shows
  const walk = (c: PickableCode, depth: number, inherited: boolean): ReasonTreeRow[] => {
    if (seen.has(c.id)) return [];
    seen.add(c.id);
    const hit = inherited || !needle || matches(c, needle);
    const kids = tree.children.get(c.id) ?? [];
    const row = { id: c.id, code: c.code, name: c.name, depth };
    if (kids.length === 0) return hit ? [{ ...row, selectable: true }] : [];
    const below = kids.flatMap((k) => walk(k, depth + 1, hit));
    return below.length ? [{ ...row, selectable: false }, ...below] : [];
  };
  return tree.roots.flatMap((root) => walk(root, 0, false));
}

/** "CODE · Name — Parent › Child" of any code of the library, "(retired)" when no longer effective. */
export function reasonCodeLabel(codes: readonly PickableCode[], id: string): string | null {
  const byId = new Map(codes.map((c) => [c.id, c]));
  const code = byId.get(id);
  if (!code) return null;
  const names: string[] = [];
  const seen = new Set<string>([code.id]);
  let parent = code.parentId ? byId.get(code.parentId) : undefined;
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    names.unshift(parent.name);
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  const retired = code.active ? '' : ' (retired)';
  return `${code.code} · ${code.name}${retired}${names.length ? ` — ${names.join(' › ')}` : ''}`;
}
