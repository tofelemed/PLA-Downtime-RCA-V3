import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { enqueueOutbox } from '../common/outbox/outbox-writer';
import {
  PeriodAccounting,
  PeriodAccountingInput,
} from '../domain/accounting/accounting.types';
import { computePeriodAccounting } from '../domain/accounting/period-accounting';
import {
  AccountingPoliciesService,
  EnginePolicies,
} from '../periods/accounting-policies.service';
import { ActualsRunnerService } from '../periods/actuals-runner.service';
import { PeriodProductSlice } from '../periods/entities/period-product-slice.entity';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { computePeriodKpis } from '../domain/kpi/period-kpis';
import {
  PeriodRecomputePort,
  RecomputeTrigger,
} from '../periods/period-recompute.port';
import {
  AccountingInputs,
  AccountingInputsLoader,
} from './accounting-inputs.loader';
import {
  failRun,
  switchPointer,
  writeRunResults,
} from './accounting-persistence';
import { draftRevisionOf } from './accounting-revisions';
import { AccountingRevision } from './entities/accounting-revision.entity';
import { CalculationRun } from './entities/calculation-run.entity';
import { hashOf, RUN_ENGINE_VERSION } from './run-input-hash';
import { writeKpiResults } from './kpi-persistence';
import { AccountingRevisionHooks } from './revision-hooks';
import {
  LoadedValuation,
  loadValuationContext,
} from '../valuation/valuation-context.loader';
import {
  storedValuations,
  SliceOwner,
  valueRunLines,
  writeRunValuations,
} from '../valuation/run-valuation';

export { RUN_ENGINE_VERSION } from './run-input-hash';

/** Message type: a period has a new validated calculation run (2.6 / 2.7 / realtime consumers). */
export const PERIOD_LOSSES_CALCULATED = 'PeriodLossesCalculated';

export type CalculationStatus =
  | 'validated'
  | 'failed'
  | 'unchanged'
  | 'revision_locked';

/** Job result: the 2.4 actuals fields (`runId` = actuals run, `reused`) plus the calculation run. */
export interface AccountingOutcome {
  runId: string | null;
  reused: boolean;
  slices: number;
  calculationRunId: string | null;
  calculation: CalculationStatus;
  [key: string]: unknown;
}

/**
 * Calculation runs of plan 2.5 (FND03): serialized per period (advisory lock + the period row lock of
 * the actuals runner), actuals first (2.4 `runIn`, reused when unchanged), then the inputs are frozen and
 * fingerprinted; an unchanged hash creates no run; otherwise a new run computes both ledgers, is
 * validated and — in the same transaction — becomes the draft's current run while the old one is
 * superseded. A failed validation keeps the previous run current and records the errors.
 */
@Injectable()
export class AccountingRunService implements OnModuleInit {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly actuals: ActualsRunnerService,
    private readonly policies: AccountingPoliciesService,
    private readonly loader: AccountingInputsLoader,
    private readonly port: PeriodRecomputePort,
    private readonly hooks: AccountingRevisionHooks,
  ) {}

  onModuleInit(): void {
    this.port.register((periodId, trigger) => this.run(periodId, trigger));
  }

  run(periodId: string, trigger: RecomputeTrigger): Promise<AccountingOutcome> {
    return this.dataSource.transaction((manager) =>
      this.runIn(manager, periodId, trigger),
    );
  }

  async runIn(
    manager: EntityManager,
    periodId: string,
    trigger: RecomputeTrigger,
  ): Promise<AccountingOutcome> {
    await manager.query(
      `SELECT pg_advisory_xact_lock(hashtext('calculation_run:' || $1))`,
      [periodId],
    );
    const actuals = await this.actuals.runIn(manager, periodId, trigger);
    const prepared = await this.prepare(manager, periodId, actuals.runId);
    const outcome = (
      calculationRunId: string | null,
      calculation: CalculationStatus,
    ): AccountingOutcome => ({
      ...actuals,
      calculationRunId,
      calculation,
    });
    const revision = await draftRevisionOf(
      manager,
      prepared.period,
      trigger.requestedBy,
    );
    if (revision.lifecycle !== 'draft') {
      await this.hooks.onInputsChanged(manager, revision, {
        inputHash: prepared.inputHash,
        trigger,
        preview: () =>
          computePeriodAccounting(
            engineInput(prepared.period, prepared.inputs, prepared.engine),
          ),
      });
      return outcome(revision.currentRunId, 'revision_locked');
    }
    const unchanged = await unchangedRun(manager, revision, prepared.inputHash);
    if (unchanged) return outcome(unchanged, 'unchanged');
    const run = await this.calculate(manager, {
      ...prepared,
      revision,
      trigger,
      actualsRunId: actuals.runId,
    });
    return outcome(run.id, run.status === 'failed' ? 'failed' : 'validated');
  }

  /** Period, slices, engine policies and the frozen inputs with their hash. */
  private async prepare(
    manager: EntityManager,
    periodId: string,
    actualsRunId: string | null,
  ): Promise<Prepared> {
    const period = await manager.findOneByOrFail(ProductionPeriod, {
      id: periodId,
    });
    const slices = await manager.find(PeriodProductSlice, {
      where: { periodId, supersededAt: IsNull() },
      order: { windowFrom: 'ASC', productId: 'ASC' },
    });
    const engine = await this.policies.resolveEngine(
      manager,
      { tenantId: period.tenantId, unitId: period.unitId },
      period.utcStart,
    );
    const inputs = await this.loader.load(
      manager,
      period,
      slices,
      actualsRunId,
    );
    const profiles = new Map(
      slices.map((s) => [
        s.id,
        { profileId: s.profileId, productId: s.productId },
      ]),
    );
    const valuation = await loadValuationContext(manager, period, {
      profileIds: slices.flatMap((s) => (s.profileId ? [s.profileId] : [])),
      productIds: slices.map((s) => s.productId),
      impactCodeIds: inputs.events.flatMap((e) =>
        e.impactCodeId ? [e.impactCodeId] : [],
      ),
    });
    return {
      period,
      engine,
      inputs,
      profiles,
      valuation,
      inputHash: hashOf(period, inputs, { engine, valuation }),
    };
  }

  /** A new run: computed, validated, then either failed (pointer kept) or switched in. */
  private async calculate(
    manager: EntityManager,
    draft: RunDraft,
  ): Promise<CalculationRun> {
    const { period, revision, inputs, engine } = draft;
    const run = await manager.save(newRun(manager, draft));
    const input = engineInput(period, inputs, engine);
    const accounting = computePeriodAccounting(input);
    if (accounting.issues.length > 0) {
      await failRun(manager, run, accounting.issues);
      return { ...run, status: 'failed' };
    }
    const scope = {
      tenantId: period.tenantId,
      periodId: period.id,
      runId: run.id,
      revisionId: revision.id,
    };
    const written = await writeValuedResults(manager, scope, accounting, draft);
    const kpis = await writeKpis(
      manager,
      { ...scope, draft, input },
      accounting,
    );
    await switchPointer(manager, revision, run, {
      ...written,
      kpis,
      segments: accounting.segmentCount,
    });
    await recordCalculated(manager, period, run, revision.currentRunId);
    return { ...run, status: 'validated' };
  }
}

/**
 * Lines with their valuation snapshot (plan 2.6), evidence and ledger totals, then the normalized line
 * valuations and valuation totals — all from the run's frozen inputs, in the run's transaction.
 */
async function writeValuedResults(
  manager: EntityManager,
  scope: {
    tenantId: string;
    periodId: string;
    runId: string;
    revisionId: string;
  },
  accounting: PeriodAccounting,
  draft: RunDraft,
): Promise<{ lines: number; evidence: number; valuedViews: number }> {
  const context = draft.valuation.context;
  const valuations = valueRunLines(accounting.lines, context, draft.profiles);
  const { ids, ...written } = await writeRunResults(
    manager,
    scope,
    accounting,
    storedValuations(valuations, context),
  );
  const valuedViews = await writeRunValuations(manager, scope, {
    lines: accounting.lines,
    ids,
    valuations,
    context,
  });
  return { ...written, valuedViews };
}

/** The run's KPIs (plan 2.7) from the same frozen inputs and ledger totals, written with the run. */
function writeKpis(
  manager: EntityManager,
  target: { tenantId: string; periodId: string; runId: string } & {
    draft: RunDraft;
    input: PeriodAccountingInput;
  },
  accounting: PeriodAccounting,
): Promise<number> {
  const { draft, input } = target;
  const scope = {
    tenantId: target.tenantId,
    periodId: target.periodId,
    runId: target.runId,
    policyId:
      draft.engine.refs.find((p) => p.kind === 'oee_policy')?.id ?? null,
    asOf: draft.inputs.asOf,
  };
  return writeKpiResults(
    manager,
    scope,
    computePeriodKpis({
      accounting: input,
      totals: accounting.totals,
      occurrences: draft.inputs.kpi.occurrences,
      failures: draft.inputs.kpi.failures,
      stateTimeline: draft.inputs.kpi.stateTimeline,
      standby: draft.inputs.kpi.standby,
    }),
  );
}

/** The run row, `running` until validated or failed. */
function newRun(manager: EntityManager, draft: RunDraft): CalculationRun {
  const { period, revision, trigger } = draft;
  return manager.create(CalculationRun, {
    tenantId: period.tenantId,
    periodId: period.id,
    revisionId: revision.id,
    actualsRunId: draft.actualsRunId,
    trigger: trigger.reason.slice(0, 64),
    engineVersion: RUN_ENGINE_VERSION,
    policyVersions: [...draft.engine.refs, draft.valuation.ref],
    inputFingerprint: draft.inputs.fingerprint,
    inputHash: draft.inputHash,
    status: 'running',
    startedAt: new Date(),
    requestedBy: trigger.requestedBy,
    createdBy: trigger.requestedBy,
    supersedesRunId: revision.currentRunId,
    valuationContext: draft.valuation.context,
  });
}

interface Prepared {
  period: ProductionPeriod;
  engine: EnginePolicies;
  inputs: AccountingInputs;
  /** slice id → profile id (valuation of quantity bases) */
  profiles: Map<string, SliceOwner>;
  valuation: LoadedValuation;
  inputHash: string;
}

interface RunDraft extends Prepared {
  revision: AccountingRevision;
  trigger: RecomputeTrigger;
  actualsRunId: string | null;
}

/** The run to keep when nothing changed: the current run, or the latest (failed) run with this hash. */
async function unchangedRun(
  manager: EntityManager,
  revision: AccountingRevision,
  inputHash: string,
): Promise<string | null> {
  if (revision.currentRunId && revision.inputHash === inputHash)
    return revision.currentRunId;
  const latest = await manager.findOne(CalculationRun, {
    where: { revisionId: revision.id },
    order: { createdAt: 'DESC', id: 'DESC' },
  });
  return latest && latest.inputHash === inputHash ? latest.id : null;
}

function engineInput(
  period: ProductionPeriod,
  inputs: AccountingInputs,
  engine: EnginePolicies,
): PeriodAccountingInput {
  return {
    window: { start: period.utcStart, end: period.utcEnd },
    periodExcluded: period.isExcluded,
    periodExclusionKind: period.exclusionKind,
    schedule: inputs.schedule,
    events: inputs.events,
    slices: inputs.slices,
    asOf: inputs.asOf,
    transitionStandards: inputs.transitionStandards,
    streamRuns: inputs.streamRuns,
    occurrences: inputs.kpi.occurrences,
    policy: {
      microStopSeconds: engine.oee.microStopSeconds,
      microStopSecondsByAssetClass: engine.oee.microStopSecondsByAssetClass,
      tripReasonCodes: engine.oee.tripReasonCodes,
      derateComponent: engine.oee.derateComponent,
      overlapAllocation: engine.oee.overlapAllocation,
      transitionAllowanceInPlan: engine.oee.transitionAllowanceInPlan,
      plannedStopsInsideScheduleReduceAvailability:
        engine.oee.plannedStopsInsideScheduleReduceAvailability,
      epsilon: String(engine.tolerance.epsilon),
    },
  };
}

/** Outbox `PeriodLossesCalculated`, committed with the pointer switch. */
async function recordCalculated(
  manager: EntityManager,
  period: ProductionPeriod,
  run: CalculationRun,
  supersededRunId: string | null,
): Promise<void> {
  await enqueueOutbox(manager, [
    {
      tenantId: period.tenantId,
      aggregateType: 'production_period',
      aggregateId: period.id,
      type: PERIOD_LOSSES_CALCULATED,
      payload: {
        periodId: period.id,
        unitId: period.unitId,
        calculationRunId: run.id,
        revisionId: run.revisionId,
        supersededRunId,
        inputHash: run.inputHash,
      },
    },
  ]);
}
