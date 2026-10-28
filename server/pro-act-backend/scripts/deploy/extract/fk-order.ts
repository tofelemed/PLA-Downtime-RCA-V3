/**
 * Load order of the extracted tables: a table comes after every table it references (Kahn's algorithm
 * restricted to the given tables, stable on the given order). Self references are not ordering edges;
 * their rows are emitted parents first by the row reader.
 */

/** One single-column foreign key: `table.column` references `references(referencedColumn)`. */
export interface ForeignKey {
  table: string;
  column: string;
  references: string;
  referencedColumn?: string;
}

function dependencies(
  tables: string[],
  fks: ForeignKey[],
): Map<string, Set<string>> {
  const listed = new Set(tables);
  const deps = new Map<string, Set<string>>(
    tables.map((t) => [t, new Set<string>()]),
  );
  for (const fk of fks) {
    if (fk.table === fk.references) continue;
    if (!listed.has(fk.table) || !listed.has(fk.references)) continue;
    deps.get(fk.table)?.add(fk.references);
  }
  return deps;
}

/** One cycle among the remaining tables, written `a -> b -> a`. */
function describeCycle(
  remaining: string[],
  deps: Map<string, Set<string>>,
): string {
  const left = new Set(remaining);
  const path: string[] = [];
  let current = remaining[0];
  while (!path.includes(current)) {
    path.push(current);
    const next = [...(deps.get(current) ?? [])].find((t) => left.has(t));
    if (next === undefined) break;
    current = next;
  }
  const cycle = path.slice(path.indexOf(current));
  return [...cycle, current].join(' -> ');
}

/** Tables in load order; throws `cycle: a -> b -> a` when the foreign keys among them form a cycle. */
export function orderTables(tables: string[], fks: ForeignKey[]): string[] {
  const deps = dependencies(tables, fks);
  const ordered: string[] = [];
  const done = new Set<string>();
  let remaining = [...tables];
  while (remaining.length > 0) {
    const ready = remaining.find((t) =>
      [...(deps.get(t) ?? [])].every((d) => done.has(d)),
    );
    if (ready === undefined) {
      throw new Error(`foreign key cycle: ${describeCycle(remaining, deps)}`);
    }
    ordered.push(ready);
    done.add(ready);
    remaining = remaining.filter((t) => t !== ready);
  }
  return ordered;
}

/** The column through which the table references itself, or null. */
export function selfReferenceColumn(
  table: string,
  fks: ForeignKey[],
): string | null {
  const own = fks.find((fk) => fk.table === table && fk.references === table);
  return own ? own.column : null;
}
