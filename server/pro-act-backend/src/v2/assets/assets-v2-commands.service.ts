import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { Asset } from '../../asset/asset.entity';
import { RequestContext } from '../../common/context/request-context';
import {
  codeTaken,
  invalidField,
  recordNotRetired,
  recordRetired,
} from '../master-data/common/master-data-errors';
import {
  organizationOfTenant,
  writerStamp,
} from '../master-data/common/master-data-writer';
import {
  definedOnly,
  keepUnlessGiven,
  updateWithRevision,
} from '../master-data/common/revisioned-update';
import { AssetV2ChangeDto, AssetV2CreateDto } from './asset-v2.dto';
import { AssetV2View, toAssetView } from './asset-v2.view';
import { AssetsV2Service } from './assets-v2.service';

/**
 * Asset writes of the v2 master-data screens: create under an active unit of the plant, change (If-Match,
 * may move the asset to another active unit), retire (replaces the v1 delete) and restore. Codes are
 * unique per plant (case-insensitive).
 */
@Injectable()
export class AssetsV2CommandsService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly reads: AssetsV2Service,
  ) {}

  async create(
    context: RequestContext,
    input: AssetV2CreateDto,
  ): Promise<AssetV2View> {
    const stamp = writerStamp(context);
    return this.manager.transaction(async (manager) => {
      await assertActiveUnit(manager, stamp.tenantId, input.unitId);
      await assertCodeFree(manager, stamp.tenantId, input.code);
      const id = randomUUID();
      await manager.getRepository(Asset).insert({
        id,
        tenantId: stamp.tenantId,
        organizationId: await organizationOfTenant(manager, stamp.tenantId),
        unitId: input.unitId,
        code: input.code,
        name: input.name,
        ...detailsOf(input),
      });
      return toAssetView(await this.reads.find(context, id, manager));
    });
  }

  async change(
    context: RequestContext,
    target: { id: string; expectedVersion: number },
    input: AssetV2ChangeDto,
  ): Promise<AssetV2View> {
    const stamp = writerStamp(context);
    return this.manager.transaction(async (manager) => {
      const asset = await this.reads.find(context, target.id, manager);
      if (asset.retiredAt) throw recordRetired('asset');
      const code = keepUnlessGiven(input.code);
      if (code !== undefined && code !== asset.code) {
        await assertCodeFree(manager, stamp.tenantId, code, asset.id);
      }
      if (input.unitId && input.unitId !== asset.unitId) {
        await assertActiveUnit(manager, stamp.tenantId, input.unitId);
      }
      await updateWithRevision(manager, Asset, target, {
        ...definedOnly({
          code,
          name: keepUnlessGiven(input.name),
          unitId: input.unitId,
        }),
        ...detailsOf(input),
      });
      return toAssetView(await this.reads.find(context, asset.id, manager));
    });
  }

  async retire(context: RequestContext, id: string): Promise<AssetV2View> {
    writerStamp(context);
    return this.manager.transaction(async (manager) => {
      const asset = await this.reads.find(context, id, manager);
      if (asset.retiredAt) throw recordRetired('asset');
      await manager
        .getRepository(Asset)
        .update(asset.id, { retiredAt: new Date() });
      return toAssetView(await this.reads.find(context, asset.id, manager));
    });
  }

  async restore(context: RequestContext, id: string): Promise<AssetV2View> {
    const stamp = writerStamp(context);
    return this.manager.transaction(async (manager) => {
      const asset = await this.reads.find(context, id, manager);
      if (!asset.retiredAt) throw recordNotRetired('asset');
      await assertActiveUnit(manager, stamp.tenantId, asset.unitId);
      await manager.getRepository(Asset).update(asset.id, { retiredAt: null });
      return toAssetView(await this.reads.find(context, asset.id, manager));
    });
  }
}

/** The descriptive fields a body names (`null` clears one). */
function detailsOf(input: AssetV2CreateDto | AssetV2ChangeDto): Partial<Asset> {
  return definedOnly({
    description: input.description,
    assetType: input.assetType,
    manufacturer: input.manufacturer,
    model: input.model,
    serialNumber: input.serialNumber,
    criticality: input.criticality,
    status: input.status,
    location: input.location,
  }) as Partial<Asset>;
}

/** 422 INVALID_REFERENCE unless the unit is an active unit of the plant. */
async function assertActiveUnit(
  manager: EntityManager,
  tenantId: string,
  unitId: string,
): Promise<void> {
  const rows = await manager.query<unknown[]>(
    `SELECT 1 FROM "units" WHERE "id" = $1 AND "tenant_id" = $2 AND "retired_at" IS NULL`,
    [unitId, tenantId],
  );
  if (rows.length === 0) {
    throw invalidField('unitId', 'unitId must be an active unit of this plant');
  }
}

/** 409 MASTER_DATA_CODE_EXISTS when another asset of the plant has the code (any case). */
async function assertCodeFree(
  manager: EntityManager,
  tenantId: string,
  code: string,
  exceptId?: string,
): Promise<void> {
  const rows = await manager.query<unknown[]>(
    `SELECT 1 FROM "assets" WHERE "tenant_id" = $1 AND lower("code") = lower($2) AND "id" <> $3 LIMIT 1`,
    [tenantId, code, exceptId ?? '00000000-0000-0000-0000-000000000000'],
  );
  if (rows.length > 0) throw codeTaken('asset', code);
}
