import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { isUniqueViolation } from '../plans/plan-errors';
import {
  invalid,
  invalidReference,
  isExclusionViolation,
  notFound,
} from '../profiles/profile-errors';
import { ProfileReferences } from '../profiles/profile-references';
import { StreamRunRecord } from './entities/stream-run.entity';
import { recordPlantModelChange } from './plant-model-events';

export interface NewStreamRun {
  unitId: string;
  streamCode: string;
  productId: string;
  lotCode?: string | null;
  startTime: string;
  endTime?: string | null;
  notes?: string | null;
}

export interface StreamRunChange {
  endTime?: string | null;
  lotCode?: string | null;
  notes?: string | null;
}

/** 409 for the two storage rules of runs: no overlap per stream, one run per lot code. */
function conflictOf(error: unknown): unknown {
  if (isExclusionViolation(error)) {
    return new ConflictException({
      code: 'STREAM_RUN_OVERLAP',
      message: 'the stream already runs a product over part of this interval',
    });
  }
  if (isUniqueViolation(error)) {
    return new ConflictException({
      code: 'LOT_CODE_TAKEN',
      message: 'another stream run already made this lot',
    });
  }
  return error;
}

function assertInterval(start: Date, end: Date | null): void {
  if (Number.isNaN(start.getTime()) || (end && !(end > start))) {
    throw invalid('INVALID_INTERVAL', 'endTime must be after startTime');
  }
}

/**
 * Which product each stream of a unit runs over time (SME E6): an operational record written by
 * production (not maker-checker master data), checked against the stream's approved version in force
 * at the run's start. Every change recalculates the unit's periods over the run.
 */
@Injectable()
export class StreamRunsService {
  constructor(
    @InjectRepository(StreamRunRecord)
    private readonly runs: Repository<StreamRunRecord>,
    private readonly references: ProfileReferences,
  ) {}

  async create(
    context: RequestContext,
    input: NewStreamRun,
  ): Promise<StreamRunRecord> {
    await this.references.assertUnit(context, input.unitId);
    await this.references.assertProduct(context, input.productId);
    const start = new Date(input.startTime);
    const end = input.endTime ? new Date(input.endTime) : null;
    assertInterval(start, end);
    const tenantId = requireTenantId(context);
    const streamCode = input.streamCode.trim();
    await this.assertStream(tenantId, input.unitId, streamCode, start);
    return this.write(async (manager) => {
      const saved = await manager.save(
        manager.create(StreamRunRecord, {
          tenantId,
          unitId: input.unitId,
          streamCode,
          productId: input.productId,
          lotCode: input.lotCode?.trim() || null,
          startTime: start,
          endTime: end,
          notes: input.notes?.trim() || null,
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
      await this.changed(manager, saved, 'recorded', saved);
      return saved;
    });
  }

  async get(context: RequestContext, id: string): Promise<StreamRunRecord> {
    const row = await scopedQuery(this.runs, 'r', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('r.id = :id', { id })
      .getOne();
    if (!row) throw notFound('Stream run');
    return row;
  }

  /** Ends a run, corrects its lot or notes; the recalculation covers the old and the new interval. */
  async update(
    context: RequestContext,
    id: string,
    change: StreamRunChange,
  ): Promise<StreamRunRecord> {
    const row = await this.get(context, id);
    const before = { ...row };
    if (change.endTime !== undefined)
      row.endTime = change.endTime ? new Date(change.endTime) : null;
    if (change.lotCode !== undefined)
      row.lotCode = change.lotCode?.trim() || null;
    if (change.notes !== undefined) row.notes = change.notes?.trim() || null;
    assertInterval(row.startTime, row.endTime);
    row.updatedBy = context.userId;
    return this.write(async (manager) => {
      const saved = await manager.save(row);
      await this.changed(manager, saved, 'updated', before);
      return saved;
    });
  }

  private async write<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.runs.manager.transaction(work);
    } catch (error: unknown) {
      throw conflictOf(error);
    }
  }

  /** 422 unless an approved version of the stream is in force at the run's start. */
  private async assertStream(
    tenantId: string,
    unitId: string,
    code: string,
    at: Date,
  ): Promise<void> {
    const rows = await this.runs.manager.query<unknown[]>(
      `SELECT 1 FROM "unit_streams" WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "code" = $3
          AND "state" = 'approved' AND "effective_from" <= $4 AND ("effective_to" IS NULL OR "effective_to" > $4)
        LIMIT 1`,
      [tenantId, unitId, code, at],
    );
    if (rows.length === 0)
      throw invalidReference('streamCode', 'approved stream of the unit');
  }

  /** The recalculation spans the run before and after the change (an open end = open-ended). */
  private changed(
    manager: EntityManager,
    row: StreamRunRecord,
    change: string,
    before: Pick<StreamRunRecord, 'startTime' | 'endTime'>,
  ): Promise<void> {
    const ends = [row.endTime, before.endTime];
    const to = ends.some((e) => e === null)
      ? null
      : new Date(Math.max(...ends.map((e) => (e as Date).getTime())));
    return recordPlantModelChange(manager, {
      tenantId: row.tenantId,
      aggregateId: row.id,
      rowVersion: row.rowVersion,
      subject: 'stream_run',
      change,
      unitId: row.unitId,
      from: row.startTime,
      to,
    });
  }
}
