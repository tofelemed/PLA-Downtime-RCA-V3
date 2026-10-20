import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ShutdownCoordinator } from '../../common/scheduling/shutdown-coordinator.service';
import {
  RECURRENCE_WATCH_DAYS,
  recurrenceWatchOf,
  watchBaselineOf,
  WatchBaseline,
  watchWindowOf,
} from '../../domain/rca/recurrence-watch';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { RCA } from '../../rca/rca.entity';
import { caseActions } from '../case-gate-facts';
import {
  caseModeFootprint,
  exposureWindow,
  ExposureRequest,
  latestIncident,
} from '../effectiveness-exposure';
import { recordReevaluation } from './recurrence-watch-recorder';

const BATCH = 200;

interface WatchedCase {
  id: string;
  tenant_id: string;
  closed_at: Date;
}

/**
 * Closed cases inside their watch (closed less than 180 days ago) without a `reevaluate` recommendation
 * fired since that closure, in id order from `after` (keyset pages, so every watched case gets its turn).
 */
const WATCHED_SQL = `SELECT r."id", r."tenant_id", COALESCE(r."closure_approved_at", r."actual_completion_date") AS "closed_at"
   FROM "rcas" r
  WHERE r."status" = 'Closed' AND r."tenant_id" IS NOT NULL AND r."id" > $3
    AND COALESCE(r."closure_approved_at", r."actual_completion_date") > $1::timestamptz - make_interval(days => $2)
    AND COALESCE(r."closure_approved_at", r."actual_completion_date") < $1
    AND NOT EXISTS (SELECT 1 FROM "rca_trigger_evaluations" t
                     WHERE t."tenant_id" = r."tenant_id" AND t."rca_id" = r."id" AND t."trigger" = 'reevaluate'
                       AND t."fired_at" >= COALESCE(r."closure_approved_at", r."actual_completion_date"))
  ORDER BY r."id" LIMIT $4`;

/**
 * D-T3 recurrence watch (Tier 2 item 2.2), hourly beside the action verification job: for each closed
 * case inside its 180-day watch, counts the same-mode unplanned incidents since the closure on the exposure
 * basis frozen with the baseline of its verified actions (`recurrenceWatchOf`). Above that baseline it
 * records one `reevaluate` recommendation per case and watch window. It never reopens or changes a case;
 * a person reopens it (accepting the recommendation) or dismisses it with a reason.
 */
@Injectable()
export class RcaRecurrenceWatchJob {
  private readonly logger = new Logger(RcaRecurrenceWatchJob.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: AccountingPoliciesService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const fired = await this.shutdown.track(this.sweep());
    if (fired > 0)
      this.logger.log(`Recommended re-evaluating ${fired} closed RCA(s)`);
  }

  /** Watches every due closed case; returns the number of new `reevaluate` recommendations. */
  async sweep(now = new Date()): Promise<number> {
    let fired = 0;
    let after = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const rows: WatchedCase[] = await this.dataSource.query(WATCHED_SQL, [
        now,
        RECURRENCE_WATCH_DAYS,
        after,
        BATCH,
      ]);
      for (const row of rows) {
        if (this.shutdown.isShuttingDown) return fired;
        if (await this.watchSafely(row, now)) fired += 1;
      }
      if (rows.length < BATCH) return fired;
      after = rows[rows.length - 1].id;
    }
  }

  /** One case in its own transaction: true when a recommendation was recorded. */
  async watchCase(rcaId: string, now = new Date()): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const rca = await manager.getRepository(RCA).findOneBy({ id: rcaId });
      const closedAt = rca?.closureApprovedAt ?? rca?.actualCloseDate ?? null;
      if (!rca?.tenantId || rca.status !== 'Closed' || !closedAt) return false;
      return this.watchIn(manager, { rca, closedAt, now });
    });
  }

  private async watchSafely(row: WatchedCase, now: Date): Promise<boolean> {
    try {
      return await this.watchCase(row.id, now);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Recurrence watch of RCA ${row.id} failed: ${message}`);
      return false;
    }
  }

  private async watchIn(
    manager: EntityManager,
    input: { rca: RCA; closedAt: Date; now: Date },
  ): Promise<boolean> {
    const { rca, closedAt, now } = input;
    const tenantId = rca.tenantId ?? '';
    const window = watchWindowOf(closedAt, now);
    const actions = await caseActions(manager, rca);
    const baseline = watchBaselineOf(
      actions.map((action) => ({
        id: action.id,
        status: action.status,
        baseline: action.baseline,
        verdict: action.postAction?.effectiveness?.verdict ?? null,
      })),
    );
    if (!window || !baseline) return false;
    const request = await this.requestOf(manager, {
      tenantId,
      rcaId: rca.id,
      baseline,
      window,
    });
    const result = recurrenceWatchOf({
      baseline,
      observed: await exposureWindow(manager, request),
    });
    if (!result.fires) return false;
    const incident = await latestIncident(manager, request);
    if (!incident) return false;
    const policy = await this.policies.rcaPolicyInForce(
      manager,
      { tenantId, unitId: rca.unitId ?? null },
      now,
    );
    return recordReevaluation(manager, {
      tenantId,
      rcaId: rca.id,
      closedAt,
      policy: { id: policy.id, version: policy.version },
      incident,
      result,
      now,
    });
  }

  /** The case's current assets and units with the failure-mode identity frozen with the baseline (CA3). */
  private async requestOf(
    manager: EntityManager,
    input: {
      tenantId: string;
      rcaId: string;
      baseline: WatchBaseline;
      window: { from: Date; to: Date };
    },
  ): Promise<ExposureRequest> {
    const frozen = input.baseline.baseline;
    const current = await caseModeFootprint(manager, {
      tenantId: input.tenantId,
      rcaId: input.rcaId,
      match: frozen.match ?? 'asset',
    });
    return {
      tenantId: input.tenantId,
      footprint: frozen.modeKeys
        ? { ...current, modeKeys: frozen.modeKeys }
        : current,
      from: input.window.from,
      to: input.window.to,
      basis: input.baseline.exposureBasis,
    };
  }
}
