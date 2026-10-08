import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { assertRevision } from '../common/concurrency/revision';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { assertEffectiveDates } from '../domain/calendar/calendar-definition';
import {
  CalendarDefinition,
  Holiday,
  ScheduleExclusion,
  ShiftTemplate,
  WorkingInterval,
} from '../domain/calendar/calendar.types';
import { generateShifts } from '../domain/calendar/shift-generator';
import { addDays, normalizeTime } from '../domain/calendar/wall-clock';
import {
  asUnprocessable,
  conflict,
  invalidReference,
  notFound,
} from './calendar-errors';
import { definitionOf } from './calendar-resolution';
import { CalendarVersion } from './entities/calendar-version.entity';
import { Site } from './entities/site.entity';
import { SitesService } from './sites.service';

/** Editable content of a calendar version (POST body; PATCH sends any subset). */
export interface CalendarContent {
  timezone?: string;
  operationalDayStart?: string;
  shiftTemplates: ShiftTemplate[];
  workingIntervals?: WorkingInterval[];
  holidays?: Holiday[];
  exclusions?: ScheduleExclusion[];
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export type NewCalendarVersion = CalendarContent & {
  siteId?: string;
  unitId?: string;
};

/** Content with the site defaults filled in. */
type ResolvedContent = CalendarContent & {
  timezone: string;
  operationalDayStart: string;
};

/** Two weeks cover every weekday: enough to find overlapping templates before anything is stored. */
const VALIDATION_DAYS = 14;

/**
 * Calendar versions (plan 2.1, CAL01): drafts are created per site (or per unit as an override) with
 * the next version number of that scope, validated by generating two weeks of instances, and edited
 * with If-Match. Published versions are immutable (409 `CALENDAR_VERSION_PUBLISHED`; the database
 * trigger refuses it too); publishing lives in `CalendarPublishService`.
 */
@Injectable()
export class CalendarVersionsService {
  constructor(
    @InjectRepository(CalendarVersion)
    private readonly versions: Repository<CalendarVersion>,
    private readonly sites: SitesService,
  ) {}

  async create(
    context: RequestContext,
    input: NewCalendarVersion,
  ): Promise<CalendarVersion> {
    const tenantId = requireTenantId(context);
    const site = await this.scopeSite(tenantId, input);
    const content = withSiteDefaults(input, site);
    assertValid(content);
    return this.versions.manager.transaction(async (manager) => {
      const unitId = input.unitId ?? null;
      const version = await nextVersion(manager, site.id, unitId);
      return manager.save(
        manager.create(CalendarVersion, {
          ...storedContent(content),
          tenantId,
          siteId: site.id,
          unitId,
          version,
          state: 'draft',
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
  }

  /** A version of the caller's tenant; 404 for foreign or unknown ids. */
  async get(context: RequestContext, id: string): Promise<CalendarVersion> {
    const version = await scopedQuery(this.versions, 'v', { context })
      .andWhere('v.id = :id', { id })
      .getOne();
    if (!version) throw notFound('Calendar version');
    return version;
  }

  async update(
    context: RequestContext,
    target: { id: string; expectedRevision: number },
    patch: Partial<CalendarContent>,
  ): Promise<CalendarVersion> {
    const current = await this.get(context, target.id);
    return this.versions.manager.transaction(async (manager) => {
      const locked = await manager.findOneOrFail(CalendarVersion, {
        where: { id: current.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (locked.state === 'published') {
        throw conflict(
          'CALENDAR_VERSION_PUBLISHED',
          'a published calendar version is immutable; create a new version',
        );
      }
      assertRevision(locked.rowVersion, target.expectedRevision);
      const content = { ...contentOf(locked), ...withoutUndefined(patch) };
      assertValid(content);
      Object.assign(locked, storedContent(content), {
        updatedBy: context.userId,
      });
      return manager.save(locked);
    });
  }

  /** Site of the new version: the unit's site for an override (422 when `siteId` disagrees). */
  private async scopeSite(
    tenantId: string,
    input: NewCalendarVersion,
  ): Promise<Site> {
    if (!input.unitId) return this.sites.resolve(tenantId, input.siteId);
    const { site } = await this.sites.unitWithSite(tenantId, input.unitId);
    if (input.siteId && input.siteId !== site.id) {
      throw invalidReference('siteId', 'site of the unit');
    }
    return site;
  }
}

/** 422 for anything the generator would refuse, found on two weeks from `effectiveFrom`. */
export function assertValid(content: ResolvedContent): void {
  asUnprocessable(() => {
    assertEffectiveDates(content.effectiveFrom, content.effectiveTo ?? null);
    generateShifts(definitionOfContent(content), {
      from: content.effectiveFrom,
      to: addDays(content.effectiveFrom, VALIDATION_DAYS - 1),
    });
  });
}

function definitionOfContent(content: ResolvedContent): CalendarDefinition {
  return definitionOf({
    timezone: content.timezone,
    operationalDayStart: content.operationalDayStart,
    shiftTemplates: content.shiftTemplates,
    workingIntervals: content.workingIntervals ?? [],
    holidays: content.holidays ?? [],
    exclusions: content.exclusions ?? [],
  });
}

function withSiteDefaults(
  input: NewCalendarVersion,
  site: Site,
): ResolvedContent {
  return {
    ...input,
    timezone: input.timezone ?? site.timezone,
    operationalDayStart:
      input.operationalDayStart ?? normalizeTime(site.operationalDayStart),
  };
}

function storedContent(content: ResolvedContent): Partial<CalendarVersion> {
  return {
    timezone: content.timezone,
    operationalDayStart: content.operationalDayStart,
    shiftTemplates: content.shiftTemplates,
    workingIntervals: content.workingIntervals ?? [],
    holidays: content.holidays ?? [],
    exclusions: content.exclusions ?? [],
    effectiveFrom: content.effectiveFrom,
    effectiveTo: content.effectiveTo ?? null,
  };
}

function contentOf(version: CalendarVersion): ResolvedContent {
  return {
    ...definitionOf(version),
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
  };
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/** Next version number of a site calendar or unit override, serialised by an advisory lock. */
async function nextVersion(
  manager: EntityManager,
  siteId: string,
  unitId: string | null,
): Promise<number> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `calendar_versions:${siteId}:${unitId ?? 'site'}`,
  ]);
  const row = await manager
    .createQueryBuilder(CalendarVersion, 'v')
    .select('COALESCE(MAX(v.version), 0)', 'max')
    .where(
      unitId ? 'v.unitId = :unitId' : 'v.siteId = :siteId AND v.unitId IS NULL',
      {
        siteId,
        unitId,
      },
    )
    .getRawOne<{ max: number | string }>();
  return Number(row?.max ?? 0) + 1;
}
