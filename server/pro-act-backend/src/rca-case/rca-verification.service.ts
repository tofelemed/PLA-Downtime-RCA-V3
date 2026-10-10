import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import { realizedDifference, windowDays } from '../domain/rca/rca-verification';
import { RcaAction, StoredPostAction } from '../rca/entities/rca-action.entity';
import { caseFootprint, footprintRecurrence } from './rca-recurrence';

/**
 * RCA03 verification (plan 3.9 step 4): once an action's verification window has ended, counts the
 * recurrences and downtime of the case's footprint inside the window and stores them with the realized
 * difference against the baseline. Runs hourly in the worker for every due action and on demand
 * (`POST /v2/rca-actions/{id}/verify`). Approved accounting is never touched.
 */
@Injectable()
export class RcaVerificationService {
  private readonly logger = new Logger(RcaVerificationService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const evaluated = await this.shutdown.track(this.sweep());
    if (evaluated > 0) this.logger.log(`Verified ${evaluated} RCA action(s)`);
  }

  async sweep(now = new Date()): Promise<number> {
    const due: Array<{ id: string }> = await this.dataSource.query(
      `SELECT "id" FROM "rca_actions" WHERE "verification_window_end" <= $1 AND "post_action" IS NULL
          AND "baseline" IS NOT NULL AND "status" <> 'cancelled' ORDER BY "verification_window_end" LIMIT 200`,
      [now],
    );
    let evaluated = 0;
    for (const { id } of due) {
      if (this.shutdown.isShuttingDown) break;
      await this.dataSource.transaction(async (manager) => {
        const action = await manager.getRepository(RcaAction).findOneBy({ id });
        if (action && !action.postAction) {
          await this.evaluateIn(manager, action, now);
          evaluated += 1;
        }
      });
    }
    return evaluated;
  }

  /** Stores the post-action observation of a due action (409 while the window is open or without baseline). */
  async evaluateIn(
    manager: EntityManager,
    action: RcaAction,
    now: Date,
  ): Promise<RcaAction> {
    const start = action.verificationWindowStart;
    const end = action.verificationWindowEnd;
    if (!start || !end || !action.baseline) {
      throw new ConflictException({
        code: 'VERIFICATION_NOT_PLANNED',
        message: 'the action has no verification window or baseline',
      });
    }
    if (end.getTime() > now.getTime()) {
      throw new ConflictException({
        code: 'VERIFICATION_WINDOW_OPEN',
        message: 'the verification window has not ended yet',
      });
    }
    const footprint = await caseFootprint(
      manager,
      action.tenantId,
      action.rcaId,
    );
    const observed = await footprintRecurrence(manager, {
      tenantId: action.tenantId,
      footprint,
      from: start,
      to: end,
    });
    const observation = {
      windowDays: windowDays(start, end),
      recurrences: observed.recurrences,
      observedLossSeconds: observed.lossSeconds,
    };
    const postAction: StoredPostAction = {
      ...observation,
      from: start.toISOString(),
      to: end.toISOString(),
      evaluatedAt: now.toISOString(),
      realized: realizedDifference(action.baseline, observation),
    };
    action.postAction = postAction;
    return manager.getRepository(RcaAction).save(action);
  }
}
