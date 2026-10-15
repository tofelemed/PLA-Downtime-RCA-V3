import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { envInt } from '../common/helpers/time-bounds';
import { deriveStops } from '../domain/reliability/derived-stops';
import { planDerivedWrites } from '../domain/reliability/derived-stop-writes';
import { EventChangeNotifier } from '../production-event/revisions/event-change.notifier';
import { EventRevisionService } from '../production-event/revisions/event-revision.service';
import {
  loadStateTimeline,
  mappingInForce,
} from '../reliability/unit-state/state-timeline.loader';
import {
  applyDerivedWrites,
  loadEngineOwned,
  UnitScope,
} from './derived-stop-writer';
import { processingWindow } from './derived-stop-window';
import { StateEngineCursor } from './entities/state-engine-cursor.entity';
import { IncidentGroupingService } from './incident-grouping.service';
import { StopEventSettingsService } from './stop-event-settings.service';
import { StopReconciliationService } from './stop-reconciliation.service';

const HOUR_MS = 3_600_000;

export interface UnitRunOutcome {
  created: number;
  updated: number;
  retracted: number;
}

const NOTHING: UnitRunOutcome = { created: 0, updated: 0, retracted: 0 };

/**
 * Plan 1.10 state engine, derived events (step 3): for one unit with a state mapping in force, re-derives
 * the stops of the window that changed since the last run (`processingWindow`: cursor, late samples, a stop
 * crossing the edge) from the SME D1 / D2 state timeline, writes the difference (create / revise /
 * retract, revisions and outbox messages), reconciles duplicates against manual and source stops and
 * regroups repeat-stop incidents — all in one transaction, serialized per unit by an advisory lock, then
 * advances the cursor. Units whose `oee_policy` turns `stopEvents.deriveFromState` off are skipped.
 */
@Injectable()
export class DerivedStopEngineService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: StopEventSettingsService,
    private readonly revisions: EventRevisionService,
    private readonly notifier: EventChangeNotifier,
    private readonly reconciliation: StopReconciliationService,
    private readonly incidents: IncidentGroupingService,
  ) {}

  processUnit(
    scope: UnitScope,
    now: Date = new Date(),
  ): Promise<UnitRunOutcome> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `state-engine:${scope.tenantId}:${scope.unitId}`,
      ]);
      return this.run(manager, scope, now);
    });
  }

  private async run(
    manager: EntityManager,
    scope: UnitScope,
    now: Date,
  ): Promise<UnitRunOutcome> {
    const mapping = await mappingInForce(manager, scope, now);
    if (!mapping) return NOTHING;
    const { settings } = await this.settings.resolve(manager, scope, now);
    if (!settings.deriveFromState) return NOTHING;
    const cursors = manager.getRepository(StateEngineCursor);
    const cursor = await cursors.findOneBy({
      tenantId: scope.tenantId,
      unitId: scope.unitId,
    });
    const window = await processingWindow(manager, {
      scope,
      mapping,
      cursor,
      settings,
      now,
      lookbackMs: envInt('STATE_ENGINE_LOOKBACK_HOURS', 24) * HOUR_MS,
    });
    const span = { start: window.start, end: now };
    const timeline = (await loadStateTimeline(manager, scope, span)) ?? [];
    const stops = deriveStops(timeline, settings, now);
    const owned = await loadEngineOwned(manager, scope, span);
    const plan = planDerivedWrites(owned, stops, randomUUID);
    const messages = await applyDerivedWrites(
      manager,
      this.revisions,
      scope,
      plan,
    );
    messages.push(
      ...(await this.reconciliation.reconcileUnit(manager, scope, span, now)),
    );
    await this.incidents.regroupUnit(manager, scope, span, now);
    await this.notifier.recordIn(manager, messages);
    await cursors.save(
      cursors.merge(
        cursor ??
          cursors.create({ tenantId: scope.tenantId, unitId: scope.unitId }),
        {
          mappingId: mapping.id,
          processedThrough: now,
          samplesSeenThrough: window.samplesSeenThrough,
        },
      ),
    );
    return {
      created: plan.create.length,
      updated: plan.update.length,
      retracted: plan.retract.length,
    };
  }
}
