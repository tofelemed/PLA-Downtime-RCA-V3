import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { enqueueOutbox } from '../common/outbox/outbox-writer';
import {
  PeriodAccounting,
  PeriodAccountingInput,
} from '../domain/accounting/accounting.types';
import {
  ACCOUNTING_ENGINE_VERSION,
  computePeriodAccounting,
} from '../domain/accounting/period-accounting';
import {
  AccountingPoliciesService,
  EnginePolicies,
} from '../periods/accounting-policies.service';
import { ActualsRunnerService } from '../periods/actuals-runner.service';
import { PeriodProductSlice } from '../periods/entities/period-product-slice.entity';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import {
  computePeriodKpis,
  KPI_ENGINE_VERSION,
} from '../domain/kpi/period-kpis';
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
import { kpiHashMaterial } from './kpi-inputs.loader';
import { writeKpiResults } from './kpi-persistence';
import { AccountingRevisionHooks } from './revision-hooks';

/** Recorded on every run: the ledger engine (2.5) and the KPI engine (2.7) it applied. */
export const RUN_ENGINE_VERSION = `${ACCOUNTING_ENGINE_VERSION}+kpi.${KPI_ENGINE_VERSION}`;

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
    return {
      period,
      engine,
      inputs,
      inputHash: hashOf(period, inputs, engine),
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
    const written = await writeRunResults(manager, scope, accounting);
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
    policyVersions: draft.engine.refs,
    inputFingerprint: draft.inputs.fingerprint,
    inputHash: draft.inputHash,
    status: 'running',
    startedAt: new Date(),
    requestedBy: trigger.requestedBy,
    createdBy: trigger.requestedBy,
    supersedesRunId: revision.currentRunId,
  });
}

interface Prepared {
  period: ProductionPeriod;
  engine: EnginePolicies;
  inputs: AccountingInputs;
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
    policy: {
      microStopSeconds: engine.oee.microStopSeconds,
      derateComponent: engine.oee.derateComponent,
      plannedStopsInsideScheduleReduceAvailability:
        engine.oee.plannedStopsInsideScheduleReduceAvailability,
      epsilon: String(engine.tolerance.epsilon),
    },
  };
}

/** sha256 over the fingerprint and every value the engine reads that an id does not pin down. */
function hashOf(
  period: ProductionPeriod,
  inputs: AccountingInputs,
  engine: EnginePolicies,
): string {
  const material = {
    engine: RUN_ENGINE_VERSION,
    policies: engine.refs,
    kpi: kpiHashMaterial(inputs.kpi),
    fingerprint: inputs.fingerprint,
    excluded: [period.isExcluded, period.exclusionKind],
    schedule: inputs.schedule.map((s) => [
      s.start.getTime(),
      s.end.getTime(),
      s.excluded,
      s.exclusionKind,
    ]),
    slices: inputs.slices.map((s) => [
      s.sliceId,
      s.window.start.getTime(),
      s.window.end.getTime(),
      s.uom,
      s.target,
    ]),
  };
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
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
