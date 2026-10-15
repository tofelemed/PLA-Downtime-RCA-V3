import { EntityManager } from 'typeorm';
import { RateKind } from '../domain/profiles/profile.types';
import {
  ImportRowError,
  ParsedImportRow,
} from '../domain/profiles/rate-import-rows';
import { covers, overlaps } from '../domain/profiles/version-window';
import { ProductionProfile } from './entities/production-profile.entity';
import { UnitProductRate } from './entities/unit-product-rate.entity';
import { refOf } from './versioning';

export interface ResolvedImportRow extends ParsedImportRow {
  profileId: string;
}

export interface ResolvedImport {
  rows: ResolvedImportRow[];
  errors: ImportRowError[];
}

/**
 * Resolves import rows inside the tenant (plan 2.2 step 4): unit and product codes, and the approved
 * profile of unit/product/mode in force at the row's `from`. Unknown codes and missing profiles are
 * row errors (`unknown_unit`, `unknown_product`, `no_profile`), never guesses.
 */
export async function resolveImportRows(
  manager: EntityManager,
  tenantId: string,
  rows: readonly ParsedImportRow[],
): Promise<ResolvedImport> {
  const units = await idsByCode(
    manager,
    `SELECT "id", "code" FROM "units" WHERE "tenant_id" = $1 AND "code" = ANY($2)`,
    [tenantId, unique(rows.map((r) => r.unitCode))],
  );
  const products = await idsByCode(
    manager,
    `SELECT "id", "code" FROM "products" WHERE "tenant_id" = $1::uuid AND "code" = ANY($2)`,
    [tenantId.toLowerCase(), unique(rows.map((r) => r.productCode))],
  );
  const profiles = await approvedProfiles(manager, tenantId, [
    ...units.values(),
  ]);
  const resolved: ResolvedImportRow[] = [];
  const errors: ImportRowError[] = [];
  for (const row of rows) {
    const outcome = matchRow(row, { units, products, profiles });
    if ('profileId' in outcome) resolved.push(outcome);
    else errors.push(outcome);
  }
  return { rows: resolved, errors };
}

interface Lookup {
  units: Map<string, string>;
  products: Map<string, string>;
  profiles: ProductionProfile[];
}

function matchRow(
  row: ParsedImportRow,
  lookup: Lookup,
): ResolvedImportRow | ImportRowError {
  const fail = (code: string, message: string): ImportRowError => ({
    line: row.line,
    code,
    message,
  });
  const unitId = lookup.units.get(row.unitCode);
  if (!unitId)
    return fail('unknown_unit', `no unit ${row.unitCode} in the tenant`);
  const productId = lookup.products.get(row.productCode);
  if (!productId) {
    return fail(
      'unknown_product',
      `no product ${row.productCode} in the tenant`,
    );
  }
  const profile = lookup.profiles.find(
    (p) =>
      p.unitId === unitId &&
      p.productId === productId &&
      p.operatingMode === row.operatingMode &&
      covers({ from: p.effectiveFrom, to: p.effectiveTo }, row.from),
  );
  return profile
    ? { ...row, profileId: profile.id }
    : fail(
        'no_profile',
        'no approved profile of this unit, product and mode at effectiveFrom',
      );
}

/**
 * Rows that would overlap an approved rate of the same profile and kind that this document does not
 * own (rows of earlier revisions of the document are about to be retired, so they never conflict).
 */
export async function overlapsWithApproved(
  manager: EntityManager,
  document: { kind: RateKind; externalId: string },
  rows: readonly ResolvedImportRow[],
): Promise<ImportRowError[]> {
  const profileIds = unique(rows.map((r) => r.profileId));
  if (profileIds.length === 0) return [];
  const approved = await manager
    .createQueryBuilder(UnitProductRate, 'r')
    .where(`r.state = 'approved' AND r.rateKind = :kind`, {
      kind: document.kind,
    })
    .andWhere('r.profileId IN (:...profileIds)', { profileIds })
    .andWhere('r.externalId IS DISTINCT FROM :externalId', {
      externalId: document.externalId,
    })
    .getMany();
  const errors: ImportRowError[] = [];
  for (const row of rows) {
    const hit = approved.find(
      (rate) => rate.profileId === row.profileId && overlaps(refOf(rate), row),
    );
    if (hit) {
      errors.push({
        line: row.line,
        code: 'overlaps_approved_rate',
        message: `overlaps approved ${document.kind} rate v${hit.version} of the profile`,
      });
    }
  }
  return errors;
}

async function idsByCode(
  manager: EntityManager,
  sql: string,
  params: unknown[],
): Promise<Map<string, string>> {
  const found = await manager.query<Array<{ id: string; code: string }>>(
    sql,
    params,
  );
  return new Map(found.map((row) => [row.code, row.id]));
}

function approvedProfiles(
  manager: EntityManager,
  tenantId: string,
  unitIds: string[],
): Promise<ProductionProfile[]> {
  if (unitIds.length === 0) return Promise.resolve([]);
  return manager
    .createQueryBuilder(ProductionProfile, 'p')
    .where(`p.tenantId = :tenantId AND p.state = 'approved'`, { tenantId })
    .andWhere('p.unitId IN (:...unitIds)', { unitIds })
    .getMany();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
