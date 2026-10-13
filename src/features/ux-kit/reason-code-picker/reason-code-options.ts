export interface PickableCode {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  path: string;
  active: boolean;
}

export interface ReasonCodeOption {
  id: string;
  /** "CODE · Name — Parent › Child" */
  label: string;
}

function parentNames(code: PickableCode, byId: ReadonlyMap<string, PickableCode>): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  let parent = code.parentId ? byId.get(code.parentId) : undefined;
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    names.unshift(parent.name);
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return names;
}

function labelOf(code: PickableCode, byId: ReadonlyMap<string, PickableCode>): string {
  const parents = parentNames(code, byId);
  const retired = code.active ? '' : ' (retired)';
  return `${code.code} · ${code.name}${retired}${parents.length ? ` — ${parents.join(' › ')}` : ''}`;
}

/**
 * FE-04: what a reason picker offers — active leaf codes (a code with children is a group, not a cause)
 * in path order, labelled with their parents' names, filtered by a case-insensitive search over the
 * label; the current value stays first even when retired or filtered out.
 */
export function reasonCodeOptions(codes: readonly PickableCode[], query: string, currentId?: string | null): ReasonCodeOption[] {
  const byId = new Map(codes.map((c) => [c.id, c]));
  const parents = new Set(codes.flatMap((c) => (c.parentId ? [c.parentId] : [])));
  const needle = query.trim().toLowerCase();
  const options = [...codes]
    .filter((c) => c.active && !parents.has(c.id) && c.id !== currentId)
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((c) => ({ id: c.id, label: labelOf(c, byId) }))
    .filter((o) => !needle || o.label.toLowerCase().includes(needle));
  const current = currentId ? byId.get(currentId) : undefined;
  return current ? [{ id: current.id, label: labelOf(current, byId) }, ...options] : options;
}
