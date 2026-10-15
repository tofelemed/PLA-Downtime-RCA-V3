import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import { DerivedStopEngineService } from './derived-stop-engine.service';

/** Units with a state mapping in force now (`IDX_unit_state_mappings_tenant_unit_from`). */
const MAPPED_UNITS_SQL = `SELECT DISTINCT m."tenant_id", m."unit_id" FROM "unit_state_mappings" m
 WHERE m."effective_from" <= $1 AND (m."effective_to" IS NULL OR m."effective_to" > $1)
 ORDER BY m."tenant_id", m."unit_id"`;

/**
 * Worker cron of the plan 1.10 state engine (every minute, worker / all roles): derives the stop events of
 * every unit with a state mapping in force, one transaction per unit; a failing unit is logged and the
 * others continue (the next run retries from its unchanged cursor).
 */
@Injectable()
export class StateEngineJob {
  private readonly logger = new Logger(StateEngineJob.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly engine: DerivedStopEngineService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    await this.shutdown.track(this.sweep());
  }

  async sweep(now: Date = new Date()): Promise<number> {
    const units = await this.dataSource.query<
      Array<{ tenant_id: string; unit_id: string }>
    >(MAPPED_UNITS_SQL, [now]);
    let written = 0;
    for (const unit of units) {
      if (this.shutdown.isShuttingDown) break;
      try {
        const outcome = await this.engine.processUnit(
          { tenantId: unit.tenant_id, unitId: unit.unit_id },
          now,
        );
        written += outcome.created + outcome.updated + outcome.retracted;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `State engine run of unit ${unit.unit_id} failed: ${message}`,
        );
      }
    }
    if (written > 0)
      this.logger.log(`State engine wrote ${written} derived stop change(s)`);
    return written;
  }
}
