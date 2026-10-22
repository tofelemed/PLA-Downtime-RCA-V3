import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarVersion } from '../../calendar/entities/calendar-version.entity';
import { CrewRotation } from '../../calendar/entities/crew-rotation.entity';
import { Crew } from '../../calendar/entities/crew.entity';
import { ShiftInstance } from '../../calendar/entities/shift-instance.entity';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { keysetPage } from '../common/keyset-page';
import { listResponse, ListResponse } from '../common/response';
import { parseSort } from '../common/sort-spec';
import { ShiftInstanceListQueryDto } from './calendar-query-v2.dto';
import { CalendarVersionListQueryDto } from './calendar-version-v2.dto';
import {
  CalendarVersionV2View,
  ShiftInstanceV2View,
  toCalendarVersionView,
  toStoredInstanceView,
} from './calendar-v2.view';
import { CrewListQueryDto, CrewRotationListQueryDto } from './crew-v2.dto';
import {
  CrewRotationV2View,
  CrewV2View,
  toCrewView,
  toRotationView,
} from './crew-v2.view';

/** v2 list reads of plan 2.1: tenant-scoped (unit-scoped for instances), keyset pages. */
@Injectable()
export class CalendarsV2Service {
  constructor(
    @InjectRepository(CalendarVersion)
    private readonly versions: Repository<CalendarVersion>,
    @InjectRepository(ShiftInstance)
    private readonly instances: Repository<ShiftInstance>,
    @InjectRepository(Crew) private readonly crews: Repository<Crew>,
    @InjectRepository(CrewRotation)
    private readonly rotations: Repository<CrewRotation>,
  ) {}

  async listVersions(
    context: RequestContext,
    query: CalendarVersionListQueryDto,
  ): Promise<ListResponse<CalendarVersionV2View>> {
    const qb = scopedQuery(this.versions, 'v', { context });
    if (query.siteId)
      qb.andWhere('v.siteId = :siteId', { siteId: query.siteId });
    if (query.unitId)
      qb.andWhere('v.unitId = :unitId', { unitId: query.unitId });
    if (query.state) qb.andWhere('v.state = :state', { state: query.state });
    if (query.siteOnly) qb.andWhere('v.unitId IS NULL');
    const page = await keysetPage(qb, {
      alias: 'v',
      property: 'createdAt',
      direction: 'ASC',
      ...paging(query),
    });
    return listResponse(
      page.items.map(toCalendarVersionView),
      page.nextCursor,
      scope(context),
    );
  }

  /** Instances overlapping `[from, to)` (half-open), by UTC start. */
  async listInstances(
    context: RequestContext,
    query: ShiftInstanceListQueryDto,
  ): Promise<ListResponse<ShiftInstanceV2View>> {
    if (query.from && query.to && new Date(query.from) >= new Date(query.to)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_RANGE',
        message: 'from must be before to',
      });
    }
    const qb = scopedQuery(this.instances, 'si', {
      context,
      unitProperty: 'unitId',
    });
    if (query.unitId)
      qb.andWhere('si.unitId = :unitId', { unitId: query.unitId });
    if (query.isExcluded !== undefined)
      qb.andWhere('si.isExcluded = :excluded', { excluded: query.isExcluded });
    if (query.from)
      qb.andWhere('si.utcEnd > :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('si.utcStart < :to', { to: new Date(query.to) });
    const sort = parseSort(query.sort, ['utcStart'] as const, {
      field: 'utcStart',
      direction: 'ASC',
    });
    const page = await keysetPage(qb, {
      alias: 'si',
      property: 'utcStart',
      direction: sort.direction,
      ...paging(query),
    });
    return listResponse(page.items.map(toStoredInstanceView), page.nextCursor, {
      ...scope(context),
      ...(query.unitId ? { unitIds: [query.unitId] } : {}),
    });
  }

  async listCrews(
    context: RequestContext,
    query: CrewListQueryDto,
  ): Promise<ListResponse<CrewV2View>> {
    const qb = scopedQuery(this.crews, 'c', { context });
    if (query.siteId)
      qb.andWhere('c.siteId = :siteId', { siteId: query.siteId });
    const page = await keysetPage(qb, {
      alias: 'c',
      property: 'createdAt',
      direction: 'ASC',
      ...paging(query),
    });
    return listResponse(
      page.items.map(toCrewView),
      page.nextCursor,
      scope(context),
    );
  }

  async listRotations(
    context: RequestContext,
    query: CrewRotationListQueryDto,
  ): Promise<ListResponse<CrewRotationV2View>> {
    const qb = scopedQuery(this.rotations, 'r', { context });
    if (query.crewId)
      qb.andWhere('r.crewId = :crewId', { crewId: query.crewId });
    const page = await keysetPage(qb, {
      alias: 'r',
      property: 'createdAt',
      direction: 'ASC',
      ...paging(query),
    });
    return listResponse(
      page.items.map(toRotationView),
      page.nextCursor,
      scope(context),
    );
  }
}

function paging(query: { cursor?: string; limit: number }): {
  cursor?: string;
  limit: number;
} {
  return { cursor: query.cursor, limit: query.limit };
}

function scope(context: RequestContext): { tenantId: string } {
  return { tenantId: requireTenantId(context) };
}
