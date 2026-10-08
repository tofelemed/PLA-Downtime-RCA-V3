import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { RotationPattern } from '../domain/calendar/crew-rotation';
import {
  addDays,
  isLocalDate,
  wallOfDate,
} from '../domain/calendar/wall-clock';
import {
  conflict,
  invalid,
  invalidReference,
  notFound,
} from './calendar-errors';
import {
  CalendarMaterializerService,
  UnitMaterialization,
} from './calendar-materializer.service';
import { HORIZON_DAYS } from './calendar-publish.service';
import { CrewRotation } from './entities/crew-rotation.entity';
import { Crew } from './entities/crew.entity';
import { SitesService } from './sites.service';

export interface NewRotation {
  crewId: string;
  pattern: RotationPattern;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

/**
 * Crews and their rotations (CAL02, plan 2.1). A rotation only assigns crews to shift instances: after
 * a new rotation the future instances of the crew's site are regenerated (bounds and exclusions stay
 * equal, so only `crew_id` changes); past instances keep their crew.
 */
@Injectable()
export class CrewsService {
  constructor(
    @InjectRepository(Crew) private readonly crews: Repository<Crew>,
    @InjectRepository(CrewRotation)
    private readonly rotations: Repository<CrewRotation>,
    private readonly sites: SitesService,
    private readonly materializer: CalendarMaterializerService,
  ) {}

  async createCrew(
    context: RequestContext,
    input: { siteId?: string; name: string },
  ): Promise<Crew> {
    const tenantId = requireTenantId(context);
    const site = await this.sites.resolve(tenantId, input.siteId);
    const name = input.name.trim();
    if (await this.crews.exists({ where: { siteId: site.id, name } })) {
      throw conflict(
        'CREW_EXISTS',
        `the site already has a crew named ${name}`,
      );
    }
    return this.crews.save(
      this.crews.create({
        tenantId,
        siteId: site.id,
        name,
        createdBy: context.userId,
        updatedBy: context.userId,
      }),
    );
  }

  async getCrew(context: RequestContext, id: string): Promise<Crew> {
    const crew = await scopedQuery(this.crews, 'c', { context })
      .andWhere('c.id = :id', { id })
      .getOne();
    if (!crew) throw notFound('Crew');
    return crew;
  }

  async createRotation(
    context: RequestContext,
    input: NewRotation,
  ): Promise<{
    rotation: CrewRotation;
    materialization: UnitMaterialization[];
  }> {
    const tenantId = requireTenantId(context);
    const crew = await this.crews.findOne({
      where: { id: input.crewId, tenantId },
    });
    if (!crew) throw invalidReference('crewId', 'crew');
    assertRotation(input);
    const rotation = await this.rotations.save(
      this.rotations.create({
        tenantId,
        crewId: crew.id,
        pattern: input.pattern,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        createdBy: context.userId,
        updatedBy: context.userId,
      }),
    );
    const site = await this.sites.resolve(tenantId, crew.siteId);
    const tomorrow = addDays(this.materializer.today(site), 1);
    const materialization = await this.materializer.materialize({
      site,
      unitIds: await this.sites.unitIdsOf(site),
      from: tomorrow,
      to: addDays(tomorrow, HORIZON_DAYS - 1),
      replaceFrom: tomorrow,
      actorId: context.userId,
    });
    return { rotation, materialization };
  }
}

function assertRotation(input: NewRotation): void {
  const { anchorDate, cycle } = input.pattern;
  if (!isLocalDate(anchorDate) || !isLocalDate(input.effectiveFrom)) {
    throw invalid(
      'INVALID_ROTATION',
      'anchorDate and effectiveFrom must be YYYY-MM-DD',
    );
  }
  const to = input.effectiveTo ?? null;
  if (
    to !== null &&
    (!isLocalDate(to) || wallOfDate(to) <= wallOfDate(input.effectiveFrom))
  ) {
    throw invalid(
      'INVALID_EFFECTIVE_DATES',
      'effectiveTo must be a date after effectiveFrom',
    );
  }
  if (cycle.length === 0 || cycle.every((slot) => slot === null)) {
    throw invalid('INVALID_ROTATION', 'the cycle needs at least one shift');
  }
}
