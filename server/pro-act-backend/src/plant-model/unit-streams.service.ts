import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { Dec, toDec } from '../domain/actuals/decimal';
import { invalid, notFound } from '../profiles/profile-errors';
import { ProfileReferences } from '../profiles/profile-references';
import { validityOf } from '../profiles/profiles.service';
import {
  approveVersion,
  nextVersion,
  retireVersion,
} from '../profiles/versioning';
import { UnitStream } from './entities/unit-stream.entity';
import { recordPlantModelChange } from './plant-model-events';

export interface NewUnitStream {
  unitId: string;
  code: string;
  name: string;
  capacityShare: string;
  notes?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

const WHAT = 'unit stream';
const ONE = new Dec(1);

const keyOf = (row: { unitId: string; code: string }) => ({
  unitId: row.unitId,
  code: row.code,
});

function assertShare(value: string): void {
  const share = toDec(value);
  if (share === null || share.lte(0) || share.gt(ONE)) {
    throw invalid('INVALID_CAPACITY_SHARE', 'capacityShare must be in (0, 1]');
  }
}

/** Σ capacity share of the other approved streams of the unit overlapping `row` (409 above 1). */
async function assertUnitShare(
  manager: EntityManager,
  row: UnitStream,
): Promise<void> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `unit_streams_share:${row.unitId}`,
  ]);
  const [others] = await manager.query<Array<{ total: string | null }>>(
    `SELECT SUM("capacity_share")::text AS "total" FROM "unit_streams"
      WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "code" <> $3 AND "state" = 'approved'
        AND tstzrange("effective_from", "effective_to", '[)') && tstzrange($4, $5, '[)')`,
    [row.tenantId, row.unitId, row.code, row.effectiveFrom, row.effectiveTo],
  );
  const total = new Dec(others?.total ?? 0).plus(new Dec(row.capacityShare));
  if (total.gt(ONE)) {
    throw new ConflictException({
      code: 'STREAM_SHARE_EXCEEDED',
      message: `the unit's streams would provide ${total.toString()} of its rate (at most 1)`,
    });
  }
}

/**
 * Streams of a unit (SME E6 / LA-10): parallel trains or lines with the share of the unit's rate each
 * provides. Drafted by master data, approved by another user (maker-checker, 403 SEPARATION_OF_DUTIES),
 * never overlapping an approved version of the same stream unless superseding it; the approved streams
 * of a unit never provide more than its whole rate (409 STREAM_SHARE_EXCEEDED).
 */
@Injectable()
export class UnitStreamsService {
  constructor(
    @InjectRepository(UnitStream)
    private readonly streams: Repository<UnitStream>,
    private readonly references: ProfileReferences,
  ) {}

  async create(
    context: RequestContext,
    input: NewUnitStream,
  ): Promise<UnitStream> {
    await this.references.assertUnit(context, input.unitId);
    assertShare(input.capacityShare);
    const validity = validityOf(input);
    const code = input.code.trim();
    return this.streams.manager.transaction(async (manager) => {
      const key = keyOf({ unitId: input.unitId, code });
      const version = await nextVersion(manager, UnitStream, key);
      return manager.save(
        manager.create(UnitStream, {
          tenantId: requireTenantId(context),
          ...key,
          name: input.name.trim(),
          capacityShare: input.capacityShare,
          notes: input.notes?.trim() || null,
          effectiveFrom: validity.from,
          effectiveTo: validity.to,
          version,
          state: 'draft',
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
  }

  async get(context: RequestContext, id: string): Promise<UnitStream> {
    const row = await scopedQuery(this.streams, 's', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('s.id = :id', { id })
      .getOne();
    if (!row) throw notFound('Unit stream');
    return row;
  }

  async approve(
    context: RequestContext,
    id: string,
    supersede: boolean,
  ): Promise<UnitStream> {
    const row = await this.get(context, id);
    return this.streams.manager.transaction(async (manager) => {
      await assertUnitShare(manager, row);
      const result = await approveVersion(
        manager,
        UnitStream,
        { id, key: keyOf(row), supersede, actorId: context.userId },
        WHAT,
      );
      await this.changed(manager, result.approved, 'approved');
      return result.approved;
    });
  }

  async retire(context: RequestContext, id: string): Promise<UnitStream> {
    const row = await this.get(context, id);
    return this.streams.manager.transaction(async (manager) => {
      const retired = await retireVersion(
        manager,
        UnitStream,
        { id: row.id, actorId: context.userId },
        WHAT,
      );
      if (row.state === 'approved')
        await this.changed(manager, retired, 'retired');
      return retired;
    });
  }

  private changed(
    manager: EntityManager,
    row: UnitStream,
    change: string,
  ): Promise<void> {
    return recordPlantModelChange(manager, {
      tenantId: row.tenantId,
      aggregateId: row.id,
      rowVersion: row.rowVersion,
      subject: 'unit_stream',
      change,
      unitId: row.unitId,
      from: row.effectiveFrom,
      to: row.effectiveTo,
    });
  }
}
