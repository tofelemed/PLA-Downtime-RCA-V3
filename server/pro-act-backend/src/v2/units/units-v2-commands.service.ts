import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { Unit } from '../../unit/unit.entity';
import {
  codeTaken,
  isUniqueViolation,
  recordNotRetired,
  recordRetired,
  unitHasActiveAssets,
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
import { UnitV2ChangeDto, UnitV2CreateDto } from './unit-v2.dto';
import { UnitV2View } from './unit-v2.view';
import { assertSiteOfPlant } from '../sites/site-references';
import { UnitsV2Service } from './units-v2.service';

/**
 * Unit writes of the v2 master-data screens: create, change (If-Match), retire and restore. Codes are
 * unique per plant (case-insensitive); retire replaces the v1 delete and is refused while the unit has
 * active assets, so events, profiles and plans keep their unit.
 */
@Injectable()
export class UnitsV2CommandsService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly reads: UnitsV2Service,
  ) {}

  async create(
    context: RequestContext,
    input: UnitV2CreateDto,
  ): Promise<UnitV2View> {
    const stamp = writerStamp(context);
    try {
      return await this.manager.transaction(async (manager) => {
        await assertCodeFree(manager, stamp.tenantId, input.code);
        await assertSiteOfPlant(manager, stamp.tenantId, input.siteId);
        const id = randomUUID();
        await manager.getRepository(Unit).insert({
          id,
          tenantId: stamp.tenantId,
          organizationId: await organizationOfTenant(manager, stamp.tenantId),
          code: input.code,
          name: input.name,
          siteId: input.siteId ?? null,
          description: input.description ?? undefined,
          unitOfMeasure: input.unitOfMeasure ?? undefined,
          capacity: decimalOrNull(input.capacity) ?? undefined,
          idealCycleTime:
            decimalOrNull(input.idealCycleTimeSeconds) ?? undefined,
        });
        return this.reads.view(context, id, manager);
      });
    } catch (error) {
      throw isUniqueViolation(error) ? codeTaken('unit', input.code) : error;
    }
  }

  async change(
    context: RequestContext,
    target: { id: string; expectedVersion: number },
    input: UnitV2ChangeDto,
  ): Promise<UnitV2View> {
    const stamp = writerStamp(context);
    const code = keepUnlessGiven(input.code);
    try {
      return await this.manager.transaction(async (manager) => {
        const unit = await this.reads.find(context, target.id, manager);
        if (unit.retiredAt) throw recordRetired('unit');
        if (code !== undefined && code !== unit.code) {
          await assertCodeFree(manager, stamp.tenantId, code, unit.id);
        }
        await assertSiteOfPlant(manager, stamp.tenantId, input.siteId);
        await updateWithRevision(manager, Unit, target, {
          ...definedOnly({
            code,
            name: keepUnlessGiven(input.name),
            siteId: input.siteId,
            description: input.description,
            unitOfMeasure: input.unitOfMeasure,
            capacity: decimalOrNull(input.capacity),
            idealCycleTime: decimalOrNull(input.idealCycleTimeSeconds),
          }),
        });
        return this.reads.view(context, unit.id, manager);
      });
    } catch (error) {
      throw isUniqueViolation(error) ? codeTaken('unit', code ?? '') : error;
    }
  }

  async retire(context: RequestContext, id: string): Promise<UnitV2View> {
    writerStamp(context);
    return this.manager.transaction(async (manager) => {
      const unit = await this.reads.find(context, id, manager);
      if (unit.retiredAt) throw recordRetired('unit');
      const active = await activeAssetCount(manager, unit.id);
      if (active > 0) throw unitHasActiveAssets(active);
      await manager
        .getRepository(Unit)
        .update(unit.id, { retiredAt: new Date() });
      return this.reads.view(context, unit.id, manager);
    });
  }

  async restore(context: RequestContext, id: string): Promise<UnitV2View> {
    writerStamp(context);
    return this.manager.transaction(async (manager) => {
      const unit = await this.reads.find(context, id, manager);
      if (!unit.retiredAt) throw recordNotRetired('unit');
      await manager.getRepository(Unit).update(unit.id, { retiredAt: null });
      return this.reads.view(context, unit.id, manager);
    });
  }
}

/** 409 MASTER_DATA_CODE_EXISTS when another unit of the plant has the code (any case). */
async function assertCodeFree(
  manager: EntityManager,
  tenantId: string,
  code: string,
  exceptId?: string,
): Promise<void> {
  const rows = await manager.query<unknown[]>(
    `SELECT 1 FROM "units" WHERE "tenant_id" = $1 AND lower("code") = lower($2) AND "id" <> $3 LIMIT 1`,
    [tenantId, code, exceptId ?? '00000000-0000-0000-0000-000000000000'],
  );
  if (rows.length > 0) throw codeTaken('unit', code);
}

async function activeAssetCount(
  manager: EntityManager,
  unitId: string,
): Promise<number> {
  const rows = await manager.query<Array<{ count: number }>>(
    `SELECT count(*)::int AS count FROM "assets" WHERE "unit_id" = $1 AND "retired_at" IS NULL`,
    [unitId],
  );
  return rows[0]?.count ?? 0;
}

/** Decimal strings go to `numeric` columns as numbers (the pg type parser reads them back as numbers). */
function decimalOrNull(
  value: string | null | undefined,
): number | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : Number(value);
}
