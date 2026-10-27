import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  BACKFILL_DAYS,
  CalendarPublishService,
} from '../../calendar/calendar-publish.service';
import { versionOn } from '../../calendar/calendar-resolution';
import { CalendarVersionsService } from '../../calendar/calendar-versions.service';
import { CalendarVersion } from '../../calendar/entities/calendar-version.entity';
import { Site } from '../../calendar/entities/site.entity';
import { SitesService } from '../../calendar/sites.service';
import { RequestContext } from '../../common/context/request-context';
import { operationalDateAt } from '../../domain/calendar/schedule-metrics';
import {
  addDays,
  normalizeTime,
  wallOfDate,
} from '../../domain/calendar/wall-clock';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import { parseLossAccounting } from '../../periods/loss-accounting-policy';
import { PeriodMaterializerService } from '../../periods/period-materializer.service';
import {
  latestApprovedPeriodDate,
  retireOpenPeriods,
  RetirementResult,
} from './loss-accounting-period-retirement';

/** No unit has this id: versionOn then sees the site calendar only. */
const NO_UNIT = '00000000-0000-0000-0000-000000000000';

/** What approving a day-grain version does to the calendar. */
export interface DailyCalendarPlan {
  site: Site;
  /** the unit override scope; null = the site calendar */
  scopeUnitId: string | null;
  unitIds: string[];
  dayStart: string;
  /** first operational date of the daily calendar */
  effectiveFrom: string;
  /** the published daily calendar already in force (a retry after a partial failure); null = to be published */
  existingVersionId: string | null;
}

export interface DailyCalendarResult extends RetirementResult {
  calendarVersionId: string;
  createdPeriods: number;
}

/**
 * Day-grain loss accounting (declared mode, D12): approving such a version publishes a daily calendar —
 * one 24 h shift starting at `dayStart` — for the policy's scope from its effective date, so the period
 * materializer creates one period per day. Open periods that the daily instances replace are retired.
 */
@Injectable()
export class LossAccountingCalendarService {
  constructor(
    private readonly sites: SitesService,
    private readonly calendars: CalendarVersionsService,
    private readonly publisher: CalendarPublishService,
    private readonly periods: PeriodMaterializerService,
  ) {}

  /**
   * What a day-grain approval does, or null for shift grain. When the calendar already gives one 24 h
   * leaf per day from that date it is reused, and the period replacement still runs (idempotent), so a
   * retry after a partial failure converges. Otherwise 422 EFFECTIVE_DATE_TOO_EARLY when a period with an
   * approved revision starts on or after the effective date.
   */
  async plan(
    manager: EntityManager,
    row: AccountingPolicy,
    effectiveFrom: Date,
  ): Promise<DailyCalendarPlan | null> {
    const body = parseLossAccounting(row.body);
    if (body.grain !== 'day') return null;
    const scopeUnitId = body.accountingUnitId ?? row.unitId;
    const site = scopeUnitId
      ? (await this.sites.unitWithSite(row.tenantId, scopeUnitId)).site
      : await this.sites.defaultSite(row.tenantId);
    const unitIds = scopeUnitId
      ? [scopeUnitId]
      : await this.sites.unitIdsOf(site);
    const date = operationalDateAt(effectiveFrom, site.timezone, body.dayStart);
    const found: DailyCalendarPlan = {
      site,
      scopeUnitId,
      unitIds,
      dayStart: body.dayStart,
      effectiveFrom: date,
      existingVersionId: null,
    };
    const existing = await this.dailyInForce(manager, found);
    if (existing) return { ...found, existingVersionId: existing.id };
    await this.assertNotTooEarly(manager, found);
    return found;
  }

  /** Publishes the daily calendar, retires the open periods it replaces and creates the daily periods. */
  async apply(
    context: RequestContext,
    manager: EntityManager,
    plan: DailyCalendarPlan,
    policyVersion: number,
  ): Promise<DailyCalendarResult> {
    const calendarVersionId =
      plan.existingVersionId ??
      (await this.publishDaily(context, plan, policyVersion));
    const retirement = await retireOpenPeriods(manager, {
      tenantId: plan.site.tenantId,
      unitIds: plan.unitIds,
      calendarVersionId,
      fromDate: plan.effectiveFrom,
    });
    const created = await this.periods.materialize(manager, {
      tenantId: plan.site.tenantId,
      unitIds: plan.unitIds,
      // two days back covers any UTC offset and an operational day starting early
      from: new Date(wallOfDate(addDays(plan.effectiveFrom, -2))),
      to: new Date(),
    });
    return {
      ...retirement,
      calendarVersionId,
      createdPeriods: created.created,
    };
  }

  /** Creates and publishes the daily calendar (its own transactions); returns the version id. */
  private async publishDaily(
    context: RequestContext,
    plan: DailyCalendarPlan,
    policyVersion: number,
  ): Promise<string> {
    const draft = await this.calendars.create(context, {
      siteId: plan.site.id,
      unitId: plan.scopeUnitId ?? undefined,
      timezone: plan.site.timezone,
      operationalDayStart: plan.dayStart,
      shiftTemplates: [
        { name: 'Day', startLocal: plan.dayStart, endLocal: plan.dayStart },
      ],
      effectiveFrom: plan.effectiveFrom,
      effectiveTo: null,
    });
    await this.publisher.publish(context, draft.id, {
      reason: `loss_accounting policy v${policyVersion}`,
      regenerateFrom: this.regenerateFrom(plan),
    });
    return draft.id;
  }

  /** The effective date, but not further back than a publication generates past dates. */
  private regenerateFrom(plan: DailyCalendarPlan): string {
    const today = operationalDateAt(
      new Date(),
      plan.site.timezone,
      normalizeTime(plan.site.operationalDayStart),
    );
    const earliest = addDays(today, -BACKFILL_DAYS);
    return plan.effectiveFrom > earliest ? plan.effectiveFrom : earliest;
  }

  /** A published, open-ended version in force on the date that already is one 24 h shift per day. */
  private async dailyInForce(
    manager: EntityManager,
    plan: DailyCalendarPlan,
  ): Promise<CalendarVersion | null> {
    const published = await manager.find(CalendarVersion, {
      where: {
        tenantId: plan.site.tenantId,
        siteId: plan.site.id,
        state: 'published',
      },
    });
    const inForce = plan.scopeUnitId
      ? versionOn(published, plan.scopeUnitId, plan.effectiveFrom)
      : versionOn(
          published.filter((v) => v.unitId === null),
          NO_UNIT,
          plan.effectiveFrom,
        );
    if (!inForce || inForce.effectiveTo !== null) return null;
    const [template] = inForce.shiftTemplates;
    const daily =
      inForce.shiftTemplates.length === 1 &&
      !template.daysOfWeek &&
      template.startLocal === template.endLocal &&
      normalizeTime(template.startLocal) === plan.dayStart &&
      normalizeTime(inForce.operationalDayStart) === plan.dayStart;
    return daily ? inForce : null;
  }

  private async assertNotTooEarly(
    manager: EntityManager,
    plan: DailyCalendarPlan,
  ): Promise<void> {
    const latest = await latestApprovedPeriodDate(manager, {
      tenantId: plan.site.tenantId,
      unitIds: plan.unitIds,
      fromDate: plan.effectiveFrom,
    });
    if (!latest) return;
    const earliest = addDays(latest, 1);
    throw new UnprocessableEntityException({
      code: 'EFFECTIVE_DATE_TOO_EARLY',
      message: `a period with an approved revision starts on ${latest}; daily accounting can start on ${earliest} at the earliest`,
    });
  }
}
