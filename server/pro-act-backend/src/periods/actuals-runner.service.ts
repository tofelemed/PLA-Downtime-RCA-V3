import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { enqueueOutbox } from '../common/outbox/outbox-writer';
import { SliceActuals } from '../domain/actuals/period/period-actuals.types';
import { Dec } from '../domain/actuals/decimal';
import {
  AccountingPoliciesService,
  ResolvedPolicies,
} from './accounting-policies.service';
import { ActualsInputsLoader, PeriodInputs } from './actuals-inputs.loader';
import { ActualsResult } from './entities/actuals-result.entity';
import { ActualsRun } from './entities/actuals-run.entity';
import { PeriodProductSlice } from './entities/period-product-slice.entity';
import {
  ProductionPeriod,
  ReadinessState,
} from './entities/production-period.entity';
import { computePeriodActuals } from './period-actuals.compute';

/** Bumped when the period engine's rules change (recorded on every run). */
// 2.4.2: SME E3 — lot dispositions classify rejects; rework acceptance and recovery are not first-pass good
export const ACTUALS_ENGINE_VERSION = '2.4.2';

/** Message type: a period has a new actuals run (2.5 / realtime consumers). */
export const PERIOD_ACTUALS_COMPUTED = 'PeriodActualsComputed';

interface RunDraft {
  inputHash: string;
  policies: ResolvedPolicies;
  results: Map<string, SliceActuals>;
  trigger: { reason: string; requestedBy: string | null };
  supersedes: string | null;
}

export interface RunOutcome {
  runId: string | null;
  reused: boolean;
  slices: number;
}

/**
 * `ActualsRunner.run(periodId)` of plan 2.4: loads the period's inputs, hashes them, and — only when the
 * hash differs from the current run's — computes every active slice and writes one immutable
 * `actuals_runs` row with its `actuals_results` (ACT06 / T44: an unchanged input set reuses the current
 * result, so loss-explanation edits never create a new actuals revision). The period points at its
 * current run; readiness is `complete_inputs` once the period has ended and every slice is complete
 * with the required coverage.
 */
@Injectable()
export class ActualsRunnerService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: AccountingPoliciesService,
    private readonly loader: ActualsInputsLoader,
  ) {}

  run(
    periodId: string,
    trigger: { reason: string; requestedBy: string | null },
  ): Promise<RunOutcome> {
    return this.dataSource.transaction((manager) =>
      this.runIn(manager, periodId, trigger),
    );
  }

  async runIn(
    manager: EntityManager,
    periodId: string,
    trigger: { reason: string; requestedBy: string | null },
  ): Promise<RunOutcome> {
    const { period, slices } = await lockPeriod(manager, periodId);
    const policies = await this.policies.resolve(
      manager,
      { tenantId: period.tenantId, unitId: period.unitId },
      period.utcStart,
    );
    const inputs = await this.loader.load(manager, period);
    const inputHash = hashOf(slices, inputs, policies);
    const current = period.currentActualsRunId
      ? await manager.findOneBy(ActualsRun, { id: period.currentActualsRunId })
      : null;
    if (current && current.inputHash === inputHash) {
      return { runId: current.id, reused: true, slices: slices.length };
    }
    const results = computePeriodActuals(slices, inputs, policies);
    const run = await this.persist(manager, period, {
      inputHash,
      policies,
      results,
      trigger,
      supersedes: current?.id ?? null,
    });
    return { runId: run.id, reused: false, slices: slices.length };
  }

  private async persist(
    manager: EntityManager,
    period: ProductionPeriod,
    draft: RunDraft,
  ): Promise<ActualsRun> {
    const computedAt = new Date();
    const run = await manager.save(
      manager.create(ActualsRun, {
        tenantId: period.tenantId,
        periodId: period.id,
        trigger: draft.trigger.reason.slice(0, 64),
        inputHash: draft.inputHash,
        engineVersion: ACTUALS_ENGINE_VERSION,
        policyVersions: draft.policies.refs,
        requestedBy: draft.trigger.requestedBy,
        createdBy: draft.trigger.requestedBy,
        supersedesRunId: draft.supersedes,
        computedAt,
      }),
    );
    const rows = [...draft.results].map(([sliceId, actuals]) =>
      resultRow(period, { runId: run.id, computedAt }, sliceId, actuals),
    );
    // jsonb columns: TypeORM's deep-partial type cannot express open records
    if (rows.length > 0)
      await manager.insert(
        ActualsResult,
        rows as QueryDeepPartialEntity<ActualsResult>[],
      );
    await manager.update(ProductionPeriod, period.id, {
      currentActualsRunId: run.id,
      stateReadiness: readinessOf(period, draft.results, draft.policies),
    });
    await recordComputed(manager, period, run.id, draft.supersedes);
    return run;
  }
}

/** The period (row-locked: one run at a time per period) and its active slices; 404 when gone. */
async function lockPeriod(
  manager: EntityManager,
  periodId: string,
): Promise<{ period: ProductionPeriod; slices: PeriodProductSlice[] }> {
  const period = await manager.findOne(ProductionPeriod, {
    where: { id: periodId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!period) {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Period not found',
    });
  }
  const slices = await manager.find(PeriodProductSlice, {
    where: { periodId, supersededAt: IsNull() },
    order: { windowFrom: 'ASC', productId: 'ASC' },
  });
  return { period, slices };
}

/** Outbox `PeriodActualsComputed`, committed with the run (2.5 / realtime consumers). */
async function recordComputed(
  manager: EntityManager,
  period: ProductionPeriod,
  runId: string,
  supersededRunId: string | null,
): Promise<void> {
  await enqueueOutbox(manager, [
    {
      tenantId: period.tenantId,
      aggregateType: 'production_period',
      aggregateId: period.id,
      type: PERIOD_ACTUALS_COMPUTED,
      payload: {
        periodId: period.id,
        unitId: period.unitId,
        actualsRunId: runId,
        supersededRunId,
        utcStart: period.utcStart.toISOString(),
        utcEnd: period.utcEnd.toISOString(),
      },
    },
  ]);
}

function resultRow(
  period: ProductionPeriod,
  run: { runId: string; computedAt: Date },
  sliceId: string,
  actuals: SliceActuals,
): Partial<ActualsResult> {
  const { runId, computedAt } = run;
  return {
    tenantId: period.tenantId,
    actualsRunId: runId,
    periodId: period.id,
    sliceId,
    gross: actuals.gross,
    good: actuals.good,
    reject: actuals.reject,
    reworkAccepted: actuals.reworkAccepted,
    uom: actuals.uom,
    basis: actuals.basis,
    method: actuals.method,
    coverageRatio: actuals.coverageRatio,
    measuredQty: actuals.measuredQty,
    estimatedQty: actuals.estimatedQty,
    qualityState: actuals.qualityState,
    sourceSegments: actuals.sourceSegments,
    exceptions: actuals.findings,
    coverage: actuals.coverage,
    adjustmentIds: actuals.adjustmentIds,
    qualityClasses: actuals.qualityClasses ?? null,
    computedAt,
  };
}

/** Display readiness (the workflow itself is 2.8): ended, and every slice complete with enough coverage. */
function readinessOf(
  period: ProductionPeriod,
  results: Map<string, SliceActuals>,
  policies: ResolvedPolicies,
): ReadinessState {
  if (period.stateReadiness === 'reconciled') return 'reconciled';
  if (period.utcEnd.getTime() > Date.now() || results.size === 0) return 'open';
  const required = new Dec(policies.coverageGate.requiredCoverageRatio);
  const ready = [...results.values()].every(
    (r) =>
      r.qualityState === 'complete' &&
      r.coverageRatio !== null &&
      new Dec(r.coverageRatio).gte(required),
  );
  return ready ? 'complete_inputs' : 'open';
}

/** sha256 over everything the results depend on (deterministic JSON). */
function hashOf(
  slices: readonly PeriodProductSlice[],
  inputs: PeriodInputs,
  policies: ResolvedPolicies,
): string {
  const material = {
    engine: ACTUALS_ENGINE_VERSION,
    policies: policies.refs,
    slices: slices.map((s) => [
      s.id,
      s.productId,
      s.windowFrom,
      s.windowTo,
      s.quantityUom,
    ]),
    events: inputs.events.map((e) => [
      e.identity,
      e.revision,
      e.start,
      e.end,
      e.quantity,
      e.rejects,
      e.uom,
    ]),
    signals: inputs.signals.map((s) => [
      s.signal.id,
      s.signal.isAuthority,
      s.samples.map((x) => [x.at.getTime(), x.value, x.quality]),
    ]),
    stops: inputs.stops.map((s) => [s.start, s.end]),
    adjustments: inputs.adjustments.map((a) => a.id),
    reports: inputs.reportLines.map((l) => [l.reportId, l.productId]),
    // approved rows are immutable; a correction is a new id that supersedes the old one
    dispositions: (inputs.dispositions ?? []).map((d) => d.id),
  };
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}
