import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import {
  effectivenessOf,
  EffectivenessResult,
  ExposureWindow,
} from '../domain/rca/effectiveness';
import {
  ActionBaseline,
  approvedCorrection,
  realizedDifference,
  windowDays,
} from '../domain/rca/rca-verification';
import { RcaAction, StoredPostAction } from '../rca/entities/rca-action.entity';
import { caseModeFootprint, exposureWindow } from './effectiveness-exposure';

/** CA2 verdict against the frozen baseline (null for a baseline typed before CA3: no exposure to compare). */
function verdictOf(
  baseline: ActionBaseline,
  post: ExposureWindow,
): EffectivenessResult | null {
  if (!baseline.window || !baseline.criteria) return null;
  return effectivenessOf({
    metric: baseline.metric,
    baseline: baseline.window,
    correctedBaseline: approvedCorrection(baseline),
    post,
    criteria: baseline.criteria,
  });
}

/**
 * RCA03 / CA2 verification (plan 3.9 step 4): once an action's verification window has ended, counts the
 * same-mode unplanned incidents of the case's assets inside the window with its run-time exposure (planned
 * and unplanned downtime excluded) and stores them with the realized difference and the effectiveness
 * verdict against the frozen baseline (an approved correction replaces the counted value). Runs hourly in the worker for every due action and on demand
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
    const { baseline } = action;
    const current = await caseModeFootprint(manager, {
      tenantId: action.tenantId,
      rcaId: action.rcaId,
      match: baseline.match ?? 'asset',
    });
    // the failure-mode identity frozen with the baseline (CA3), the case's current assets and units
    const footprint = baseline.modeKeys
      ? { ...current, modeKeys: baseline.modeKeys }
      : current;
    const exposure = await exposureWindow(manager, {
      tenantId: action.tenantId,
      footprint,
      from: start,
      to: end,
      // the run-time basis frozen with the baseline, so both rates share one exposure (CA3)
      basis: baseline.window?.exposureBasis ?? 'unit_run_time',
    });
    const observation = {
      windowDays: windowDays(start, end),
      recurrences: exposure.incidents,
      observedLossSeconds: exposure.downtimeSeconds,
    };
    const effectiveness = verdictOf(baseline, exposure);
    const postAction: StoredPostAction = {
      ...observation,
      from: start.toISOString(),
      to: end.toISOString(),
      evaluatedAt: now.toISOString(),
      realized: realizedDifference(baseline, observation),
      exposure,
      ...(effectiveness ? { effectiveness } : {}),
    };
    action.postAction = postAction;
    return manager.getRepository(RcaAction).save(action);
  }
}
