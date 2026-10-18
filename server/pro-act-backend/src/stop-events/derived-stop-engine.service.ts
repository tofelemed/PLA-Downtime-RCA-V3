import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { envInt } from '../common/helpers/time-bounds';
import {
  DerivedSlowdown,
  deriveSlowdowns,
  describeSlowdown,
} from '../domain/reliability/derived-slowdowns';
import { deriveStops } from '../domain/reliability/derived-stops';
import {
  DerivedWritePlan,
  EngineOwnedEvent,
  planDerivedWrites,
  planEngineWrites,
} from '../domain/reliability/derived-stop-writes';
import { StopEventOptions } from '../periods/stop-event-options';
import {
  EventChangeMessage,
  EventChangeNotifier,
} from '../production-event/revisions/event-change.notifier';
import { EventRevisionService } from '../production-event/revisions/event-revision.service';
import {
  loadStateInputs,
  mappingInForce,
} from '../reliability/unit-state/state-timeline.loader';
import { RuleClassificationService } from '../rules/rule-classification.service';
import { ActiveCodingRule } from '../rules/rule-defaults';
import { applySlowdownWrites, isSlowdownKey } from './derived-slowdown-writer';
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
  /** plan 1.10 reduced-rate slowdowns created / revised / retracted; absent = none written */
  slowdowns?: { created: number; updated: number; retracted: number };
}

const NOTHING: UnitRunOutcome = { created: 0, updated: 0, retracted: 0 };

const counts = (plan: {
  create: unknown[];
  update: unknown[];
  retract: unknown[];
}) => ({
  created: plan.create.length,
  updated: plan.update.length,
  retracted: plan.retract.length,
});

/**
 * Plan 1.10 state engine, derived events (step 3): for one unit with a state mapping in force, re-derives
 * the stops of the window that changed since the last run (`processingWindow`: cursor, late samples, a stop
 * crossing the edge) from the SME D1 / D2 state timeline, writes the difference (create / revise /
 * retract, revisions and outbox messages), reconciles duplicates against manual and source stops and
 * regroups repeat-stop incidents — all in one transaction, serialized per unit by an advisory lock, then
 * advances the cursor. Reduced-rate spans of the timeline (analog thresholds or a mapped reduced-rate code)
 * become slowdown (performance) events the same idempotent way, never stops. Units whose `oee_policy` turns `stopEvents.deriveFromState` off are skipped.
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
    private readonly ruleDefaults: RuleClassificationService,
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
      lateHorizonMs: envInt('STATE_ENGINE_LATE_SAMPLE_HOURS', 168) * HOUR_MS,
    });
    const span = { start: window.start, end: now };
    const { messages, outcome } = await this.writeDerived(manager, {
      scope,
      span,
      settings,
    });
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
    return outcome;
  }

  /** Stops and reduced-rate slowdowns of the span from the timeline, written as the difference. */
  private async writeDerived(
    manager: EntityManager,
    input: {
      scope: UnitScope;
      span: { start: Date; end: Date };
      settings: StopEventOptions;
    },
  ): Promise<{ messages: EventChangeMessage[]; outcome: UnitRunOutcome }> {
    const { scope, span, settings } = input;
    const inputs = await loadStateInputs(manager, scope, span);
    const timeline = inputs?.segments ?? [];
    const owned = await loadEngineOwned(manager, scope, span);
    const ownedSlowdowns = owned.filter(isSlowdownKey);
    const plan = planDerivedWrites(
      owned.filter((o) => !isSlowdownKey(o)),
      deriveStops(timeline, settings, span.end),
      randomUUID,
    );
    const slowPlan = planEngineWrites(
      ownedSlowdowns,
      deriveSlowdowns(timeline, inputs?.samples ?? [], {
        config: settings,
        ratedValue: inputs?.config.thresholds?.ratedValue ?? null,
        liveEdge: span.end,
      }),
      { newId: randomUUID, describe: describeSlowdown },
    );
    const messages = await this.applyPlans(manager, {
      scope,
      plan,
      slowPlan,
      ownedSlowdowns,
    });
    return {
      messages,
      outcome: {
        ...counts(plan),
        // only when the unit has reduced-rate spans (the outcome of stop-only units is unchanged)
        ...(slowPlan.create.length +
          slowPlan.update.length +
          slowPlan.retract.length >
        0
          ? { slowdowns: counts(slowPlan) }
          : {}),
      },
    };
  }

  /**
   * Writes both plans. New events get the tenant's active `coding_default` rules (plan 3.8), loaded once
   * per run and only when the run creates events.
   */
  private async applyPlans(
    manager: EntityManager,
    input: {
      scope: UnitScope;
      plan: DerivedWritePlan;
      slowPlan: DerivedWritePlan<DerivedSlowdown>;
      ownedSlowdowns: readonly EngineOwnedEvent[];
    },
  ): Promise<EventChangeMessage[]> {
    const { scope, plan, slowPlan } = input;
    const rules: ActiveCodingRule[] =
      plan.create.length + slowPlan.create.length > 0
        ? await this.ruleDefaults.activeRules(scope.tenantId)
        : [];
    return [
      ...(await applyDerivedWrites(manager, this.revisions, {
        scope,
        rules,
        plan,
      })),
      ...(await applySlowdownWrites(manager, this.revisions, {
        scope,
        rules,
        plan: slowPlan,
        owned: input.ownedSlowdowns,
      })),
    ];
  }
}
