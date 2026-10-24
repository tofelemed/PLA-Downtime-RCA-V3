import { Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { Unit } from '../../unit/unit.entity';

export interface UnitAssetPresenceRow {
  unitId: string;
  has_assets: boolean;
}

export interface UnitAssetPresence {
  unitId: string;
  hasAssets: boolean;
}

/** Maps the raw query rows to the API shape. */
export function assetPresenceRows(
  rows: UnitAssetPresenceRow[],
): UnitAssetPresence[] {
  return rows.map((row) => ({
    unitId: row.unitId,
    hasAssets: row.has_assets === true,
  }));
}

/** One row per unit the caller may see: whether it has at least one active (not retired) asset. */
export async function queryUnitAssetPresence(
  units: Repository<Unit>,
  context: RequestContext,
): Promise<UnitAssetPresenceRow[]> {
  return scopedQuery(units, 'u', { context, unitProperty: 'id' })
    .select('u.id', 'unitId')
    .addSelect(
      `EXISTS (SELECT 1 FROM assets a WHERE a.tenant_id = u.tenant_id AND a.unit_id = u.id::text AND a.retired_at IS NULL)`,
      'has_assets',
    )
    .orderBy('u.id')
    .getRawMany<UnitAssetPresenceRow>();
}
