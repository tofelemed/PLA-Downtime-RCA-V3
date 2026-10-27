import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
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
import {
  boundaryOf,
  cutInstances,
  cutPeriods,
  DAILY_SHIFT_NAME,
  isDailyDraft,
  isDailyShape,
  switchOf,
  SwitchCut,
  unitsOnSiteCalendar,
} from './loss-accounting-switch';

/** No unit has this id: versionOn then sees the site calendar only. */
const NO_UNIT = '00000000-0000-0000-0000-000000000000';

/** What approving a day-grain version does to the calendar. */
export interface DailyCalendarPlan {
  site: Site;
  /** the unit override scope; null = the site calendar */
  scopeUnitId: string | null;
  unitIds: string[];
  dayStart: string;
  /** first operational date of the daily calendar (the switch date; can be later than the policy's) */
  effectiveFrom: string;
  /** first instant of the daily calendar; null = a daily calendar was already in force (nothing to cut) */
  switchStart: Date | null;
  /** the published daily calendar already in force (a retry after a partial failure); null = to be published */
  existingVersionId: string | null;
}

export interface DailyCalendarResult extends RetirementResult {
  calendarVersionId: string;
  effectiveFrom: string;
  /** old-calendar periods ended at the switch */
  clippedPeriods: number;
  createdPeriods: number;
}

/**
 * Day-grain loss accounting (declared mode, D12): approving such a version publishes a daily calendar —
 * one 24 h shift starting at `dayStart` — for the policy's scope, so the period materializer creates one
 * period per day. It starts at the first `dayStart` on or after the effective date that cuts no
 * calculated period (`switchOf`): old-calendar instances and open periods from there on are removed and
 * the ones crossing it end there (`loss-accounting-switch.ts`).
 */
@Injectable()
export class LossAccountingCalendarService {
  constructor(
    private readonly sites: SitesService,
    private readonly calendars: CalendarVersionsService,
    private readonly publisher: CalendarPublishService,
    private readonly periods: PeriodMaterializerService,
    @InjectRepository(CalendarVersion)
    private readonly versions: Repository<CalendarVersion>,
  ) {}

  /**
   * What a day-grain approval does, or null for shift grain. A daily calendar already in force (an earlier
   * policy, or a retry after a partial failure) is reused and the period replacement still runs
   * (idempotent), so a retry converges. Otherwise 422 EFFECTIVE_DATE_TOO_EARLY when a period with an
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
    const date = operationalDateAt(effectiveFrom, site.timezone, body.dayStart);
    const unitIds = scopeUnitId
      ? [scopeUnitId]
      : await unitsOnSiteCalendar(
          manager,
          { tenantId: row.tenantId, unitIds: await this.sites.unitIdsOf(site) },
          date,
        );
    const base: DailyCalendarPlan = {
      site,
      scopeUnitId,
      unitIds,
      dayStart: body.dayStart,
      effectiveFrom: date,
      switchStart: null,
      existingVersionId: null,
    };
    const inForce = await this.dailyInForce(manager, base);
    if (inForce) return this.adopt(base, inForce);
    await this.assertNotTooEarly(manager, base);
    return this.planSwitch(manager, base);
  }

  /** Publishes the daily calendar (cutting the old one), retires the open periods it replaces, creates daily periods. */
  async apply(
    context: RequestContext,
    manager: EntityManager,
    plan: DailyCalendarPlan,
    policyVersion: number,
  ): Promise<DailyCalendarResult> {
    const calendarVersionId =
      plan.existingVersionId ??
      (await this.publishDaily(context, plan, policyVersion));
    const cut = plan.switchStart
      ? await cutPeriods(
          manager,
          this.cutOf(plan, plan.switchStart, calendarVersionId),
        )
      : { retired: 0, clippedPeriods: 0 };
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
      retired: retirement.retired + cut.retired,
      keptInstances: retirement.keptInstances,
      calendarVersionId,
      effectiveFrom: plan.effectiveFrom,
      clippedPeriods: cut.clippedPeriods,
      createdPeriods: created.created,
    };
  }

  /** The switch after the last calculated period; a daily calendar an earlier attempt published there is reused. */
  private async planSwitch(
    manager: EntityManager,
    base: DailyCalendarPlan,
  ): Promise<DailyCalendarPlan> {
    const scope = {
      tenantId: base.site.tenantId,
      unitIds: base.unitIds,
      zone: base.site.timezone,
      dayStart: base.dayStart,
    };
    const found = await switchOf(manager, scope, base.effectiveFrom);
    const planned: DailyCalendarPlan = {
      ...base,
      effectiveFrom: found.date,
      switchStart: found.start,
    };
    const published = await this.dailyInForce(manager, planned);
    return published ? this.adopt(base, published) : planned;
  }

  /**
   * Reuses a daily calendar in force. One starting on or after the policy's effective date was published by
   * an earlier attempt of this switch: its period cut runs again (it was rolled back with that attempt).
   */
  private adopt(
    base: DailyCalendarPlan,
    version: CalendarVersion,
  ): DailyCalendarPlan {
    const existingVersionId = version.id;
    if (version.effectiveFrom < base.effectiveFrom)
      return { ...base, existingVersionId };
    const switchStart = boundaryOf(
      base.site.timezone,
      version.effectiveFrom,
      base.dayStart,
    );
    return {
      ...base,
      effectiveFrom: version.effectiveFrom,
      switchStart,
      existingVersionId,
    };
  }

  /** Ends the old calendar at the switch (committed), then publishes the daily calendar (own transactions). */
  private async publishDaily(
    context: RequestContext,
    plan: DailyCalendarPlan,
    policyVersion: number,
  ): Promise<string> {
    const draftId = await this.draftFor(context, plan);
    const switchStart = plan.switchStart;
    if (switchStart) {
      await this.versions.manager.transaction((manager) =>
        cutInstances(manager, {
          ...this.cutOf(plan, switchStart, draftId),
          zone: plan.site.timezone,
          actorId: context.userId,
        }),
      );
    }
    await this.publisher.publish(context, draftId, {
      reason: `loss_accounting policy v${policyVersion}`,
      regenerateFrom: this.regenerateFrom(plan),
    });
    return draftId;
  }

  /** The draft a failed earlier attempt left behind (moved to the switch date), else a new draft. */
  private async draftFor(
    context: RequestContext,
    plan: DailyCalendarPlan,
  ): Promise<string> {
    const drafts = await this.versions.find({
      where: {
        tenantId: plan.site.tenantId,
        siteId: plan.site.id,
        unitId: plan.scopeUnitId ?? IsNull(),
        state: 'draft',
      },
      order: { version: 'DESC' },
    });
    const orphan = drafts.find(
      (v) =>
        isDailyDraft(v, plan.dayStart) && v.timezone === plan.site.timezone,
    );
    if (!orphan) return this.createDraft(context, plan);
    if (orphan.effectiveFrom !== plan.effectiveFrom) {
      await this.calendars.update(
        context,
        { id: orphan.id, expectedRevision: orphan.rowVersion },
        { effectiveFrom: plan.effectiveFrom },
      );
    }
    return orphan.id;
  }

  private async createDraft(
    context: RequestContext,
    plan: DailyCalendarPlan,
  ): Promise<string> {
    const draft = await this.calendars.create(context, {
      siteId: plan.site.id,
      unitId: plan.scopeUnitId ?? undefined,
      timezone: plan.site.timezone,
      operationalDayStart: plan.dayStart,
      shiftTemplates: [
        {
          name: DAILY_SHIFT_NAME,
          startLocal: plan.dayStart,
          endLocal: plan.dayStart,
        },
      ],
      effectiveFrom: plan.effectiveFrom,
      effectiveTo: null,
    });
    return draft.id;
  }

  private cutOf(
    plan: DailyCalendarPlan,
    start: Date,
    calendarVersionId: string,
  ): SwitchCut {
    return {
      tenantId: plan.site.tenantId,
      unitIds: plan.unitIds,
      start,
      calendarVersionId,
    };
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
    return isDailyShape(inForce, plan.dayStart) ? inForce : null;
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
