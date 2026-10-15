import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { appendAudit } from '../common/audit/audit-trail';
import { RequestContext } from '../common/context/request-context';
import { ApprovalAction } from '../reconciliation/entities/approval-action.entity';
import {
  latestRevision,
  lockPeriod,
  periodInScope,
  requireUser,
} from '../reconciliation/revision-access';
import {
  DataHoldKind,
  PeriodDataHold,
} from './entities/period-data-hold.entity';
import {
  PeriodSla,
  ReconciliationSlaService,
} from './reconciliation-sla.service';

/** A period's SLA with its holds and the latest rejection (what failed, the new due time). */
export interface PeriodSlaSnapshot {
  periodId: string;
  sla: PeriodSla;
  holds: PeriodDataHold[];
  lastRejection: ApprovalAction | null;
}

export interface OpenHoldCommand {
  kind: DataHoldKind;
  reason: string;
}

const HISTORY_LIMIT = 20;

/**
 * "Waiting for data" (SME R3) and the SLA of one period: a preparer opens a hold with a reason (lab
 * result, failed source, other) that pauses the clocks, and releases it when the data arrived. At most one
 * open hold; never on an approved period. Both steps are audited.
 */
@Injectable()
export class PeriodSlaService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly slas: ReconciliationSlaService,
  ) {}

  snapshot(
    context: RequestContext,
    periodId: string,
  ): Promise<PeriodSlaSnapshot> {
    return this.dataSource.transaction(async (manager) => {
      const period = await periodInScope(manager, context, periodId);
      return this.read(manager, period);
    });
  }

  openHold(
    context: RequestContext,
    periodId: string,
    command: OpenHoldCommand,
  ): Promise<PeriodSlaSnapshot> {
    const actor = requireUser(context);
    return this.dataSource.transaction(async (manager) => {
      const period = await periodInScope(manager, context, periodId);
      await lockPeriod(manager, period.id);
      const revision = await latestRevision(manager, period.id);
      if (revision?.lifecycle === 'approved') {
        throw new ConflictException({
          code: 'PERIOD_APPROVED',
          message:
            'an approved period waits for nothing; a late value goes through a change proposal',
        });
      }
      if (await this.openOf(manager, period.id)) {
        throw new ConflictException({
          code: 'HOLD_OPEN',
          message: 'the period already waits for data; release that hold first',
        });
      }
      const hold = await manager.save(
        manager.create(PeriodDataHold, {
          tenantId: period.tenantId,
          periodId: period.id,
          unitId: period.unitId,
          kind: command.kind,
          reason: command.reason,
          startedAt: new Date(),
          startedBy: actor,
          createdBy: actor,
        }),
      );
      await this.audit(manager, context, hold, 'opened', command.reason);
      return this.read(manager, period);
    });
  }

  releaseHold(
    context: RequestContext,
    periodId: string,
    note: string | null,
  ): Promise<PeriodSlaSnapshot> {
    const actor = requireUser(context);
    return this.dataSource.transaction(async (manager) => {
      const period = await periodInScope(manager, context, periodId);
      await lockPeriod(manager, period.id);
      const hold = await this.openOf(manager, period.id);
      if (!hold) {
        throw new ConflictException({
          code: 'NO_OPEN_HOLD',
          message: 'the period is not waiting for data',
        });
      }
      await manager.update(PeriodDataHold, hold.id, {
        endedAt: new Date(),
        endedBy: actor,
        endNote: note,
        updatedBy: actor,
      });
      await this.audit(manager, context, hold, 'released', note);
      return this.read(manager, period);
    });
  }

  private openOf(
    manager: EntityManager,
    periodId: string,
  ): Promise<PeriodDataHold | null> {
    return manager.findOneBy(PeriodDataHold, { periodId, endedAt: IsNull() });
  }

  private async read(
    manager: EntityManager,
    period: { id: string; tenantId: string; unitId: string; localDate: string },
  ): Promise<PeriodSlaSnapshot> {
    const slas = await this.slas.statuses(manager, [period], new Date());
    const revision = await latestRevision(manager, period.id);
    const [holds, lastRejection] = await Promise.all([
      manager.find(PeriodDataHold, {
        where: { periodId: period.id },
        order: { startedAt: 'DESC' },
        take: HISTORY_LIMIT,
      }),
      revision
        ? manager.findOne(ApprovalAction, {
            where: { revisionId: revision.id, action: 'reject' },
            order: { createdAt: 'DESC' },
          })
        : Promise.resolve(null),
    ]);
    return {
      periodId: period.id,
      sla: slas.get(period.id) as PeriodSla,
      holds,
      lastRejection,
    };
  }

  private audit(
    manager: EntityManager,
    context: RequestContext,
    hold: PeriodDataHold,
    step: 'opened' | 'released',
    reason: string | null,
  ): Promise<void> {
    return appendAudit(manager, [
      {
        tenantId: hold.tenantId,
        actorId: context.userId,
        action: `period_data_hold.${step}`,
        entityType: 'production_period',
        entityId: hold.periodId,
        reason,
        correlationId: context.correlationId || null,
        detail: { holdId: hold.id, kind: hold.kind },
      },
    ]);
  }
}
