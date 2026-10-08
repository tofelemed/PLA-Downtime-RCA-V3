import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { addDays, isLocalDate } from '../domain/calendar/wall-clock';
import { conflict, invalid } from './calendar-errors';
import {
  CalendarMaterializerService,
  UnitMaterialization,
} from './calendar-materializer.service';
import {
  assertValid,
  CalendarVersionsService,
} from './calendar-versions.service';
import { definitionOf } from './calendar-resolution';
import { CalendarVersion } from './entities/calendar-version.entity';
import { Site } from './entities/site.entity';
import { SitesService } from './sites.service';

/** Instances are kept generated this many operational days ahead (plan 2.1 step 4). */
export const HORIZON_DAYS = 90;
/** A publication generates missing past dates at most this far back. */
export const BACKFILL_DAYS = 366;

export interface PublishCommand {
  /** required to re-publish; recorded on the version and in the audit log */
  reason?: string;
  /** with a reason: regenerate from this operational date (past dates included) */
  regenerateFrom?: string;
}

export interface PublishResult {
  version: CalendarVersion;
  materialization: UnitMaterialization[];
}

/**
 * Publishing (plan 2.1 step 4): a draft becomes published (immutable) and the instances of the units it
 * governs are generated from `max(effectiveFrom, today − 366 d)` to `today + 90 d`. Future dates are
 * regenerated; past dates are only filled where missing. Re-publishing an already published version
 * needs a reason and may regenerate past dates from `regenerateFrom` (the global audit interceptor
 * logs the request; the reason is kept on the version).
 */
@Injectable()
export class CalendarPublishService {
  private readonly logger = new Logger(CalendarPublishService.name);

  constructor(
    @InjectRepository(CalendarVersion)
    private readonly versions: Repository<CalendarVersion>,
    private readonly calendarVersions: CalendarVersionsService,
    private readonly sites: SitesService,
    private readonly materializer: CalendarMaterializerService,
  ) {}

  async publish(
    context: RequestContext,
    id: string,
    command: PublishCommand,
  ): Promise<PublishResult> {
    const current = await this.calendarVersions.getWritable(context, id);
    assertCommand(current, command);
    assertValid({
      ...definitionOf(current),
      effectiveFrom: current.effectiveFrom,
      effectiveTo: current.effectiveTo,
    });
    const site = await this.sites.resolve(current.tenantId, current.siteId);
    const unitIds = current.unitId
      ? [current.unitId]
      : await this.sites.unitIdsOf(site);
    const result = await this.versions.manager.transaction(async (manager) => {
      const version = await this.markPublished(
        manager,
        context,
        current,
        command,
      );
      const window = this.window(site, version, command);
      const materialization = window
        ? await this.materializer.materialize(
            { site, unitIds, ...window, actorId: context.userId },
            manager,
          )
        : [];
      return { version, materialization };
    });
    this.logger.log(
      `Calendar version ${current.id} (v${current.version}) published; ` +
        `${result.materialization.reduce((n, m) => n + m.insertedInstances, 0)} instance(s) written`,
    );
    return result;
  }

  private async markPublished(
    manager: EntityManager,
    context: RequestContext,
    current: CalendarVersion,
    command: PublishCommand,
  ): Promise<CalendarVersion> {
    const locked = await manager.findOneOrFail(CalendarVersion, {
      where: { id: current.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (locked.state === 'draft') {
      locked.state = 'published';
      locked.publishedAt = new Date();
      locked.publishedBy = context.userId;
    } else {
      locked.republishReason = command.reason?.trim() ?? null;
    }
    locked.updatedBy = context.userId;
    return manager.save(locked);
  }

  /** Dates to materialize and the first date that may be regenerated. */
  private window(
    site: Site,
    version: CalendarVersion,
    command: PublishCommand,
  ): { from: string; to: string; replaceFrom: string } | null {
    const today = this.materializer.today(site);
    const earliest = addDays(today, -BACKFILL_DAYS);
    const from = maxDate(version.effectiveFrom, earliest);
    const horizon = addDays(today, HORIZON_DAYS);
    const to = version.effectiveTo
      ? minDate(addDays(version.effectiveTo, -1), horizon)
      : horizon;
    const replaceFrom = command.regenerateFrom ?? addDays(today, 1);
    if (command.regenerateFrom && (replaceFrom < from || replaceFrom > to)) {
      throw invalid(
        'INVALID_REGENERATE_FROM',
        `regenerateFrom must be within ${from} … ${to}`,
      );
    }
    return to < from ? null : { from, to, replaceFrom };
  }
}

function assertCommand(
  current: CalendarVersion,
  command: PublishCommand,
): void {
  const reason = command.reason?.trim();
  if (current.state === 'published' && !reason) {
    throw conflict(
      'ALREADY_PUBLISHED',
      'the version is published; re-publishing needs a reason',
    );
  }
  if (command.regenerateFrom && !reason) {
    throw invalid(
      'REASON_REQUIRED',
      'regenerating past instances needs a reason',
    );
  }
  if (command.regenerateFrom && !isLocalDate(command.regenerateFrom)) {
    throw invalid(
      'INVALID_REGENERATE_FROM',
      'regenerateFrom must be YYYY-MM-DD',
    );
  }
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

function minDate(a: string, b: string): string {
  return a < b ? a : b;
}
