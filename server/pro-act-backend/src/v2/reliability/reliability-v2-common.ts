import { UnprocessableEntityException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { BoundedInterval } from '../../domain/time/interval-algebra';
import { assertBodyUnitsInScope } from '../../periods/period-scope';
import { plural } from '../../common/helpers/plural';

/** 422 INVALID_RANGE unless `from < to`; both required for an analytical window. */
export function windowOf(from: string, to: string): BoundedInterval {
  const window = { start: new Date(from), end: new Date(to) };
  if (!(window.start < window.end)) {
    throw new UnprocessableEntityException({
      code: 'INVALID_RANGE',
      message: 'from must be before to',
    });
  }
  return window;
}

export interface AssetRef {
  id: string;
  unitId: string;
  code: string;
}

/** Assets of the tenant by id or code (case-insensitive), one query. */
export async function assetsOf(
  manager: EntityManager,
  tenantId: string,
  keys: { ids: readonly string[]; codes: readonly string[] },
): Promise<AssetRef[]> {
  if (keys.ids.length === 0 && keys.codes.length === 0) return [];
  return manager.query<AssetRef[]>(
    `SELECT "id", "unit_id" AS "unitId", "code" FROM "assets"
      WHERE "tenant_id" = $1 AND ("id"::text = ANY($2::text[]) OR lower("code") = ANY($3::text[]))`,
    [tenantId, keys.ids, keys.codes.map((c) => c.toLowerCase())],
  );
}

/** A unit-scoped caller may only write records of its units (403 otherwise, as period bodies). */
export function assertUnitsWritable(
  context: RequestContext,
  unitIds: readonly string[],
): void {
  assertBodyUnitsInScope(context, [...new Set(unitIds)], 'assetId');
}

export interface RowProblem {
  line: number;
  message: string;
}

/** 422 with every row problem of an import; nothing is stored. */
export function rowsInvalid(
  code: string,
  errors: readonly RowProblem[],
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code,
    message: `The import has ${plural(errors.length, 'invalid row', 'invalid rows')}; nothing was stored`,
    details: { errors },
  });
}

export const toIso = (value: Date | null) =>
  value ? value.toISOString() : null;
