import { EntityManager } from 'typeorm';
import { ChangeRow, ChangeSource, NameRef } from './change-types';

const TABLES: Readonly<Record<NameRef, string>> = {
  product: 'products',
  unit: 'units',
  asset: 'assets',
  user: 'users',
  'impact-code': 'impact_codes',
  'reason-code': 'reason_codes',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idsByRef(sources: readonly ChangeSource[]): Map<NameRef, Set<string>> {
  const ids = new Map<NameRef, Set<string>>();
  const add = (ref: NameRef, value: unknown) => {
    if (typeof value !== 'string' || !UUID.test(value)) return;
    ids.set(ref, (ids.get(ref) ?? new Set()).add(value));
  };
  for (const source of sources) {
    for (const spec of source.specs) {
      if (spec.labelRef) add(spec.labelRef.ref, spec.labelRef.id);
      if (!spec.ref) continue;
      add(spec.ref, source.after[spec.key]);
      add(spec.ref, source.before?.[spec.key]);
    }
  }
  return ids;
}

/** One query per referenced table for every record of the response (never per record). */
async function namesOf(
  manager: EntityManager,
  tenantId: string,
  ids: Map<NameRef, Set<string>>,
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const [ref, set] of ids) {
    const rows = await manager.query<Array<{ id: string; name: string }>>(
      `SELECT id::text AS id, name FROM ${TABLES[ref]} WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
      [tenantId, [...set]],
    );
    rows.forEach((row) => names.set(`${ref}:${row.id}`, row.name));
  }
  return names;
}

function renamed(
  row: ChangeRow,
  source: ChangeSource,
  names: Map<string, string>,
): ChangeRow {
  const next = { ...row };
  for (const spec of source.specs) {
    const value = row[spec.key];
    if (!spec.ref || typeof value !== 'string') continue;
    next[spec.key] = names.get(`${spec.ref}:${value}`) ?? 'Record not visible';
  }
  return next;
}

/** Replaces referenced ids (products, units, assets, users, codes) by their names, in place of the id. */
export async function withNames(
  manager: EntityManager,
  tenantId: string,
  sources: ChangeSource[],
): Promise<ChangeSource[]> {
  const ids = idsByRef(sources);
  if (ids.size === 0) return sources;
  const names = await namesOf(manager, tenantId, ids);
  return sources.map((source) => ({
    ...source,
    specs: source.specs.map((spec) =>
      spec.labelRef
        ? {
            ...spec,
            label: `${spec.label} · ${names.get(`${spec.labelRef.ref}:${spec.labelRef.id}`) ?? 'no reason'}`,
          }
        : spec,
    ),
    after: renamed(source.after, source, names),
    before: source.before ? renamed(source.before, source, names) : null,
  }));
}
