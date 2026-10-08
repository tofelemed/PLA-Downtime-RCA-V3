import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, EntityManager, In, IsNull, Repository } from 'typeorm';
import { assignCrews } from '../domain/calendar/crew-rotation';
import { GeneratedShift } from '../domain/calendar/calendar.types';
import {
  instancesHash,
  operationalDateAt,
} from '../domain/calendar/schedule-metrics';
import { generateShifts } from '../domain/calendar/shift-generator';
import { datesInRange, normalizeTime } from '../domain/calendar/wall-clock';
import {
  asUnprocessable,
  invalid,
  isExclusionViolation,
} from './calendar-errors';
import { definitionOf, versionRuns } from './calendar-resolution';
import { CrewRotationsLoader } from './crew-rotations.loader';
import { CalendarVersion } from './entities/calendar-version.entity';
import { ShiftInstance } from './entities/shift-instance.entity';
import { Site } from './entities/site.entity';

/** A generated row before it is stored. */
export type InstanceRow = GeneratedShift & { calendarVersionId: string };

export interface MaterializeRequest {
  site: Site;
  unitIds: string[];
  /** operational dates, inclusive */
  from: string;
  to: string;
  /** dates from here on are regenerated (replaced when different); earlier dates are only gap-filled */
  replaceFrom: string | null;
  actorId: string | null;
}

export interface UnitMaterialization {
  unitId: string;
  from: string;
  to: string;
  insertedInstances: number;
  deletedInstances: number;
  /** dates whose stored instances already matched (idempotent regeneration) */
  unchangedDates: number;
  /** content hash of the unit's instances in the range after the run */
  hash: string;
}

const INSERT_CHUNK = 500;

/**
 * Stores shift instances (plan 2.1 step 4): generates what the published versions say for each unit and
 * date, then per operational date either keeps the stored rows (past dates are immutable), fills a
 * missing date, or — from `replaceFrom` on — replaces the rows when their content hash differs. Equal
 * hashes write nothing, so regeneration is idempotent. One transaction per unit under an advisory lock.
 */
@Injectable()
export class CalendarMaterializerService {
  constructor(
    @InjectRepository(ShiftInstance)
    private readonly instances: Repository<ShiftInstance>,
    private readonly rotations: CrewRotationsLoader,
  ) {}

  /** Operational date "today" at the site. */
  today(site: Site, now: Date = new Date()): string {
    return operationalDateAt(
      now,
      site.timezone,
      normalizeTime(site.operationalDayStart),
    );
  }

  /** Runs inside `manager`'s transaction when one is given (publication), else one per unit. */
  async materialize(
    request: MaterializeRequest,
    manager: EntityManager = this.instances.manager,
  ): Promise<UnitMaterialization[]> {
    const published = await this.publishedVersions(
      request.site,
      request.unitIds,
      manager,
    );
    const rotations = await this.rotations.forSite(request.site, manager);
    const results: UnitMaterialization[] = [];
    for (const unitId of request.unitIds) {
      const generated = asUnprocessable(() =>
        this.generate(published, unitId, request),
      );
      const rows = assignCrews(generated, rotations);
      results.push(await this.store(manager, request, unitId, rows));
    }
    return results;
  }

  /** Instances the published versions give a unit for `[from, to]`, without storing anything. */
  generate(
    published: CalendarVersion[],
    unitId: string,
    range: { from: string; to: string },
  ): InstanceRow[] {
    return versionRuns(published, unitId, range).flatMap((run) =>
      generateShifts(definitionOf(run.version), run).instances.map((s) => ({
        ...s,
        calendarVersionId: run.version.id,
      })),
    );
  }

  /** Published site versions and unit overrides of the given units. */
  publishedVersions(
    site: Site,
    unitIds: string[],
    manager: EntityManager = this.instances.manager,
  ): Promise<CalendarVersion[]> {
    const where = [
      {
        tenantId: site.tenantId,
        siteId: site.id,
        unitId: IsNull(),
        state: 'published' as const,
      },
      ...(unitIds.length
        ? [
            {
              tenantId: site.tenantId,
              unitId: In(unitIds),
              state: 'published' as const,
            },
          ]
        : []),
    ];
    return manager.find(CalendarVersion, { where });
  }

  private async store(
    manager: EntityManager,
    request: MaterializeRequest,
    unitId: string,
    generated: InstanceRow[],
  ): Promise<UnitMaterialization> {
    try {
      return await manager.transaction((inner) =>
        this.storeUnit(inner, request, unitId, generated),
      );
    } catch (error: unknown) {
      if (!isExclusionViolation(error)) throw error;
      throw invalid(
        'INSTANCE_OVERLAP',
        'generated shifts would overlap stored shifts of the unit (e.g. a time zone change between versions)',
      );
    }
  }

  private async storeUnit(
    manager: EntityManager,
    request: MaterializeRequest,
    unitId: string,
    generated: InstanceRow[],
  ): Promise<UnitMaterialization> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `shift_instances:${unitId}`,
    ]);
    const stored = await manager.find(ShiftInstance, {
      where: { unitId, localDate: Between(request.from, request.to) },
      order: { utcStart: 'ASC' },
    });
    const plan = planWrites(request, stored, generated);
    if (plan.deleteIds.length)
      await manager.delete(ShiftInstance, plan.deleteIds);
    for (let i = 0; i < plan.insert.length; i += INSERT_CHUNK) {
      const chunk = plan.insert.slice(i, i + INSERT_CHUNK);
      await manager.insert(
        ShiftInstance,
        chunk.map((row) => toEntity(row, request, unitId)),
      );
    }
    return {
      unitId,
      from: request.from,
      to: request.to,
      insertedInstances: plan.insert.length,
      deletedInstances: plan.deleteIds.length,
      unchangedDates: plan.unchangedDates,
      hash: instancesHash(plan.final),
    };
  }
}

interface WritePlan {
  deleteIds: string[];
  insert: InstanceRow[];
  final: InstanceRow[];
  unchangedDates: number;
}

/** Per date: keep (past or equal), fill (missing) or replace (from `replaceFrom`, when different). */
function planWrites(
  request: MaterializeRequest,
  stored: ShiftInstance[],
  generated: InstanceRow[],
): WritePlan {
  const storedByDate = groupByDate(stored.map(rowOf));
  const idsByDate = groupIds(stored);
  const generatedByDate = groupByDate(generated);
  const plan: WritePlan = {
    deleteIds: [],
    insert: [],
    final: [],
    unchangedDates: 0,
  };
  for (const date of datesInRange(request.from, request.to)) {
    const current = storedByDate.get(date) ?? [];
    const next = generatedByDate.get(date) ?? [];
    const replaceable =
      request.replaceFrom !== null && date >= request.replaceFrom;
    const missing = current.length === 0;
    if (
      (!replaceable && !missing) ||
      instancesHash(current) === instancesHash(next)
    ) {
      plan.final.push(...current);
      if (current.length || next.length) plan.unchangedDates += 1;
      continue;
    }
    plan.deleteIds.push(...(idsByDate.get(date) ?? []));
    plan.insert.push(...next);
    plan.final.push(...next);
  }
  return plan;
}

function groupByDate(rows: InstanceRow[]): Map<string, InstanceRow[]> {
  const map = new Map<string, InstanceRow[]>();
  for (const row of rows)
    map.set(row.localDate, [...(map.get(row.localDate) ?? []), row]);
  return map;
}

function groupIds(rows: ShiftInstance[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows)
    map.set(row.localDate, [...(map.get(row.localDate) ?? []), row.id]);
  return map;
}

/** Stored row in the generator's shape (for hashing and the final view). */
export function rowOf(entity: ShiftInstance): InstanceRow {
  return {
    calendarVersionId: entity.calendarVersionId,
    localDate: entity.localDate,
    shiftName: entity.shiftName,
    utcStart: new Date(entity.utcStart),
    utcEnd: new Date(entity.utcEnd),
    utcOffsetStart: entity.utcOffsetStart,
    utcOffsetEnd: entity.utcOffsetEnd,
    localStart: entity.localStart,
    localEnd: entity.localEnd,
    isExcluded: entity.isExcluded,
    exclusionKind: entity.exclusionKind,
    exclusionReason: entity.exclusionReason,
    crewId: entity.crewId,
  };
}

function toEntity(
  row: InstanceRow,
  request: MaterializeRequest,
  unitId: string,
): Partial<ShiftInstance> {
  return {
    ...row,
    tenantId: request.site.tenantId,
    unitId,
    createdBy: request.actorId,
    updatedBy: request.actorId,
  };
}
