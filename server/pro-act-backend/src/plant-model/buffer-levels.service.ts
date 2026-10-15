import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { toDec } from '../domain/actuals/decimal';
import { isUniqueViolation } from '../plans/plan-errors';
import { invalid, invalidReference } from '../profiles/profile-errors';
import { ProfileReferences } from '../profiles/profile-references';
import {
  BufferLevelRecord,
  BufferLevelSource,
} from './entities/buffer-level.entity';
import { MAX_LEVEL_AGE_SECONDS } from './plant-flow-rules';
import { recordPlantModelChange } from './plant-model-events';

export interface NewBufferLevel {
  fromUnitId: string;
  toUnitId: string;
  observedAt: string;
  level: string;
  uom: string;
  source?: BufferLevelSource;
  notes?: string | null;
}

/**
 * Recorded buffer (silo) levels (SME E2): a reading of the buffer of an approved route in force at the
 * reading, in the route's inventory unit. It recalculates the downstream unit over the hours it covers.
 */
@Injectable()
export class BufferLevelsService {
  constructor(
    @InjectRepository(BufferLevelRecord)
    private readonly levels: Repository<BufferLevelRecord>,
    private readonly references: ProfileReferences,
  ) {}

  async record(
    context: RequestContext,
    input: NewBufferLevel,
  ): Promise<BufferLevelRecord> {
    await this.references.assertUnit(context, input.toUnitId, 'toUnitId');
    const tenantId = requireTenantId(context);
    const observedAt = new Date(input.observedAt);
    const level = toDec(input.level);
    if (!level || level.isNegative())
      throw invalid('INVALID_LEVEL', 'level must be ≥ 0');
    await this.assertRoute(tenantId, input, observedAt);
    try {
      return await this.levels.manager.transaction(async (manager) => {
        const saved = await manager.save(
          manager.create(BufferLevelRecord, {
            tenantId,
            fromUnitId: input.fromUnitId,
            toUnitId: input.toUnitId,
            observedAt,
            level: input.level,
            uom: input.uom.trim(),
            source: input.source ?? 'manual',
            notes: input.notes?.trim() || null,
            createdBy: context.userId,
            updatedBy: context.userId,
          }),
        );
        await recordPlantModelChange(manager, {
          tenantId,
          aggregateId: saved.id,
          rowVersion: saved.rowVersion,
          subject: 'plant_flow',
          change: 'level_recorded',
          unitId: saved.toUnitId,
          from: observedAt,
          to: new Date(observedAt.getTime() + MAX_LEVEL_AGE_SECONDS * 1000),
        });
        return saved;
      });
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) throw error;
      throw new ConflictException({
        code: 'LEVEL_EXISTS',
        message: 'a level of this buffer is already recorded at this instant',
      });
    }
  }

  /** 422 unless an approved route with a buffer in this unit is in force at the reading. */
  private async assertRoute(
    tenantId: string,
    input: NewBufferLevel,
    at: Date,
  ): Promise<void> {
    const rows = await this.levels.manager.query<
      Array<{ inventory_uom: string | null }>
    >(
      `SELECT "inventory_uom" FROM "plant_flow_routes"
        WHERE "tenant_id" = $1 AND "from_unit_id" = $2 AND "to_unit_id" = $3 AND "state" = 'approved'
          AND "effective_from" <= $4 AND ("effective_to" IS NULL OR "effective_to" > $4)
        LIMIT 1`,
      [tenantId, input.fromUnitId, input.toUnitId, at],
    );
    if (rows.length === 0)
      throw invalidReference('fromUnitId', 'approved flow route');
    if (rows[0].inventory_uom !== input.uom.trim()) {
      throw invalid(
        'UOM_MISMATCH',
        `the buffer is kept in ${rows[0].inventory_uom ?? 'no unit (no buffer)'}`,
      );
    }
  }
}
