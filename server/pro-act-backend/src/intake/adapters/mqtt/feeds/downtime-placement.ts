import { DataSource } from 'typeorm';
import { MappingSample } from '../../../../source-mapping/mapping-resolver';
import {
  ResolvedMapping,
  TenantMappingResolver,
} from '../../../../source-mapping/source-mapping.service';

/** A unit or asset of the tenant matched by its code. */
interface CodeTarget {
  id: string;
  unitId: string | null;
}

/**
 * Where a downtime-feed stop happened (owner 26 Oct 2026): a source mapping for MQTT on the unit or
 * equipment code wins (the quarantine's "Bind" creates one); otherwise the payload's unit code is the
 * Traverse Forge unit code and its equipment code an asset code (case-insensitive, retired ones
 * excluded). Equipment alone places the stop on the asset's unit; an asset of another unit is ignored.
 */
export class DowntimePlacement {
  private constructor(
    private readonly mappings: Pick<TenantMappingResolver, 'resolve'>,
    private readonly units: ReadonlyMap<string, CodeTarget>,
    private readonly assets: ReadonlyMap<string, CodeTarget>,
    private readonly codes: { unit: string | null; equipment: string | null },
  ) {}

  static async load(
    dataSource: DataSource,
    input: {
      tenantId: string;
      mappings: Pick<TenantMappingResolver, 'resolve'>;
      unit: string | null;
      equipment: string | null;
    },
  ): Promise<DowntimePlacement> {
    const [units, assets] = await Promise.all([
      codeTargets(dataSource, 'units', input.tenantId, input.unit),
      codeTargets(dataSource, 'assets', input.tenantId, input.equipment),
    ]);
    return new DowntimePlacement(input.mappings, units, assets, {
      unit: input.unit,
      equipment: input.equipment,
    });
  }

  /** Same contract as the source-mapping resolver, so the frame ingest path places the stop with it. */
  resolve(sample: MappingSample): ResolvedMapping {
    const mapped = this.mappings.resolve(sample);
    if (mapped.status !== 'unmapped') return mapped;
    if (this.codes.equipment && this.codes.equipment !== sample.sourcePath) {
      const byEquipment = this.mappings.resolve({
        sourcePath: this.codes.equipment,
      });
      if (byEquipment.status !== 'unmapped') return byEquipment;
    }
    return this.byCode();
  }

  private byCode(): ResolvedMapping {
    const unit = this.codes.unit
      ? this.units.get(this.codes.unit.toLowerCase())
      : undefined;
    const asset = this.codes.equipment
      ? this.assets.get(this.codes.equipment.toLowerCase())
      : undefined;
    const unitId = unit?.id ?? asset?.unitId ?? null;
    if (!unitId) return { status: 'unmapped' };
    const assetId = asset && asset.unitId === unitId ? asset.id : null;
    return {
      status: 'mapped',
      tier: 'exact_id',
      unitId,
      assetId,
      mappingId: 'code',
      version: 0,
      origin: 'source_mapping',
    };
  }
}

async function codeTargets(
  dataSource: DataSource,
  table: 'units' | 'assets',
  tenantId: string,
  code: string | null,
): Promise<Map<string, CodeTarget>> {
  if (!code) return new Map();
  const unitColumn = table === 'assets' ? '"unit_id"' : 'NULL';
  const rows = await dataSource.query<
    Array<{ id: string; unit_id: string | null; code: string }>
  >(
    `SELECT "id", ${unitColumn} AS "unit_id", "code" FROM "${table}"
      WHERE "tenant_id" = $1 AND lower("code") = lower($2) AND "retired_at" IS NULL`,
    [tenantId, code],
  );
  // two rows with one code (case variants) are ambiguous: no placement by code then
  return rows.length === 1
    ? new Map([
        [
          rows[0].code.toLowerCase(),
          { id: rows[0].id, unitId: rows[0].unit_id },
        ],
      ])
    : new Map();
}
