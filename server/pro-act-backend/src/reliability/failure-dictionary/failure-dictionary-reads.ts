import { EntityManager, SelectQueryBuilder } from 'typeorm';
import { DictionaryEntryRef } from '../../domain/reliability/failure-dictionary';
import { FailureDictionaryEntry } from '../entities/failure-dictionary-entry.entity';

/** Entries in force at the instant: `effective_from <= at < effective_to`. */
export function inForceAt<T extends FailureDictionaryEntry>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  at: Date,
): SelectQueryBuilder<T> {
  return qb.andWhere(
    `${alias}.effectiveFrom <= :inForceAt AND (${alias}.effectiveTo IS NULL OR ${alias}.effectiveTo > :inForceAt)`,
    { inForceAt: at },
  );
}

const ENTRIES_IN_FORCE_SQL = `SELECT "entry_kind", "equipment_class", "code", "name", "asset_types"
  FROM "failure_dictionary_entries"
 WHERE "tenant_id" = $1 AND "effective_from" <= $2 AND ("effective_to" IS NULL OR "effective_to" > $2)`;

interface EntryRow {
  entry_kind: DictionaryEntryRef['kind'];
  equipment_class: string;
  code: string;
  name: string;
  asset_types: string[];
}

/** The dictionary of a tenant in force at an instant (bounded by the plant's dictionary size). */
export async function dictionaryInForce(
  manager: EntityManager,
  tenantId: string,
  at: Date,
): Promise<DictionaryEntryRef[]> {
  const rows = await manager.query<EntryRow[]>(ENTRIES_IN_FORCE_SQL, [
    tenantId,
    at,
  ]);
  return rows.map((row) => ({
    kind: row.entry_kind,
    equipmentClass: row.equipment_class,
    code: row.code,
    name: row.name,
    assetTypes: row.asset_types ?? [],
  }));
}

/** Open entries of a tenant (the current dictionary an import compares with). */
export function openEntries(
  manager: EntityManager,
  tenantId: string,
): Promise<FailureDictionaryEntry[]> {
  return manager
    .getRepository(FailureDictionaryEntry)
    .createQueryBuilder('d')
    .where('d.tenantId = :tenantId AND d.effectiveTo IS NULL', { tenantId })
    .getMany();
}
