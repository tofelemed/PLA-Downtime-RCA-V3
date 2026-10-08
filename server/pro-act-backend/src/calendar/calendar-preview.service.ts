import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { restrictedUnitIds } from '../common/query/scoped-query';
import {
  CalendarDefinition,
  CalendarWarning,
  GeneratedShift,
} from '../domain/calendar/calendar.types';
import { assignCrews } from '../domain/calendar/crew-rotation';
import { generateShifts } from '../domain/calendar/shift-generator';
import {
  daysBetween,
  isLocalDate,
  normalizeTime,
} from '../domain/calendar/wall-clock';
import { asUnprocessable, invalid, invalidReference } from './calendar-errors';
import { rowOf } from './calendar-materializer.service';
import { definitionOf } from './calendar-resolution';
import { CalendarContent } from './calendar-versions.service';
import { CrewRotationsLoader } from './crew-rotations.loader';
import { CalendarVersion } from './entities/calendar-version.entity';
import { ShiftInstance } from './entities/shift-instance.entity';
import { Site } from './entities/site.entity';
import { diffInstances, InstanceDiff } from './instance-diff';
import { SitesService } from './sites.service';

export const PREVIEW_MAX_DAYS = 62;

export interface PreviewRequest {
  unitId: string;
  localFrom: string;
  localTo: string;
  candidateVersionId?: string;
  candidateVersion?: Omit<CalendarContent, 'effectiveFrom' | 'effectiveTo'>;
}

export interface CalendarPreview {
  unitId: string;
  siteId: string;
  timezone: string;
  candidateVersionId: string | null;
  instances: Array<GeneratedShift & { calendarVersionId: string | null }>;
  warnings: CalendarWarning[];
  diff: InstanceDiff;
}

/**
 * Preview of a candidate calendar for one unit and operational dates (plan 2.1 step 6, §15.2): the
 * instances it would generate (with crews), DST and crew warnings, and the difference to the instances
 * stored today. Nothing is written.
 */
@Injectable()
export class CalendarPreviewService {
  constructor(
    @InjectRepository(CalendarVersion)
    private readonly versions: Repository<CalendarVersion>,
    @InjectRepository(ShiftInstance)
    private readonly instances: Repository<ShiftInstance>,
    private readonly sites: SitesService,
    private readonly rotations: CrewRotationsLoader,
  ) {}

  async preview(
    context: RequestContext,
    request: PreviewRequest,
  ): Promise<CalendarPreview> {
    const tenantId = requireTenantId(context);
    assertRange(request);
    assertUnitInScope(context, tenantId, request.unitId);
    const { site } = await this.sites.unitWithSite(tenantId, request.unitId);
    const candidate = await this.candidate(tenantId, site, request);
    const range = { from: request.localFrom, to: request.localTo };
    const generated = asUnprocessable(() =>
      generateShifts(candidate.definition, range),
    );
    const warnings = [...generated.warnings];
    if (site.timezoneFallback) {
      warnings.unshift({
        code: 'timezone_fallback',
        localDate: range.from,
        shiftName: null,
      });
    }
    const rows = assignCrews(
      generated.instances.map((s) => ({
        ...s,
        calendarVersionId: candidate.id,
      })),
      await this.rotations.forSite(site),
      warnings,
    );
    const stored = await this.instances.find({
      where: {
        tenantId,
        unitId: request.unitId,
        localDate: Between(range.from, range.to),
      },
      order: { utcStart: 'ASC' },
    });
    return {
      unitId: request.unitId,
      siteId: site.id,
      timezone: candidate.definition.timezone,
      candidateVersionId: candidate.id,
      instances: rows,
      warnings,
      diff: diffInstances(stored.map(rowOf), rows),
    };
  }

  private async candidate(
    tenantId: string,
    site: Site,
    request: PreviewRequest,
  ): Promise<{ id: string | null; definition: CalendarDefinition }> {
    if (
      Boolean(request.candidateVersionId) === Boolean(request.candidateVersion)
    ) {
      throw invalid(
        'CANDIDATE_REQUIRED',
        'send exactly one of candidateVersionId and candidateVersion',
      );
    }
    if (request.candidateVersion) {
      const inline = request.candidateVersion;
      const definition = definitionOf({
        timezone: inline.timezone ?? site.timezone,
        operationalDayStart:
          inline.operationalDayStart ?? normalizeTime(site.operationalDayStart),
        shiftTemplates: inline.shiftTemplates,
        workingIntervals: inline.workingIntervals ?? [],
        holidays: inline.holidays ?? [],
        exclusions: inline.exclusions ?? [],
      });
      return { id: null, definition };
    }
    const version = await this.versions.findOne({
      where: { id: request.candidateVersionId, tenantId },
    });
    const applies =
      version?.siteId === site.id &&
      (!version.unitId || version.unitId === request.unitId);
    if (!version || !applies) {
      throw invalidReference(
        'candidateVersionId',
        'calendar version of the unit',
      );
    }
    return { id: version.id, definition: definitionOf(version) };
  }
}

function assertRange(request: PreviewRequest): void {
  if (!isLocalDate(request.localFrom) || !isLocalDate(request.localTo)) {
    throw invalid('INVALID_RANGE', 'localFrom and localTo must be YYYY-MM-DD');
  }
  const days = daysBetween(request.localFrom, request.localTo) + 1;
  if (days < 1 || days > PREVIEW_MAX_DAYS) {
    throw invalid(
      'INVALID_RANGE',
      `localFrom … localTo must span 1 to ${PREVIEW_MAX_DAYS} days`,
    );
  }
}

/** A caller limited to some units previews only those (422, no existence leak). */
function assertUnitInScope(
  context: RequestContext,
  tenantId: string,
  unitId: string,
): void {
  const allowed = restrictedUnitIds(context, tenantId);
  if (allowed && !allowed.includes(unitId))
    throw invalidReference('unitId', 'unit');
}
