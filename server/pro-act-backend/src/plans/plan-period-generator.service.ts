import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { generatePeriods } from '../domain/plans/period-generator';
import {
  Distribution,
  GenerationResult,
  ManualTarget,
  SliceInput,
} from '../domain/plans/plan.types';
import { PlanPeriod } from './entities/plan-period.entity';
import { PlanProductSlice } from './entities/plan-product-slice.entity';
import { PlanVersion } from './entities/plan-version.entity';
import { windowOf } from './plan-content';
import { asUnprocessable, conflict } from './plan-errors';
import { PlanInputsLoader } from './plan-inputs.loader';

const INSERT_CHUNK = 500;

/** `CONCURRENT_PRODUCTS=true` enables independent / shared streams (D14; default off). */
export function concurrentProductsEnabled(): boolean {
  return process.env.CONCURRENT_PRODUCTS === 'true';
}

/**
 * `PlanPeriodGenerator` of plan 2.3: loads the unit's shift instances and the slices' approved profiles
 * and rates, runs the pure generator (422 on refusals: NO_ELIGIBLE_TIME, CAMPAIGN_OVERLAP,
 * INFEASIBLE_PRODUCT_MIX, ...), and either returns the preview or replaces an open version's periods in
 * the caller's transaction. Approved versions are never regenerated (their periods are frozen).
 */
@Injectable()
export class PlanPeriodGeneratorService {
  constructor(private readonly inputs: PlanInputsLoader) {}

  async compute(
    version: PlanVersion,
    slices: readonly PlanProductSlice[],
    distribution: Distribution | null,
  ): Promise<GenerationResult> {
    const window = windowOf(version);
    const leaves = await this.inputs.leaves(
      version.tenantId,
      version.unitId,
      window,
    );
    const ratesAt = await this.inputs.ratesLookup(
      version.tenantId,
      version.unitId,
      slices,
      window,
    );
    return asUnprocessable(() =>
      generatePeriods({
        basis: version.basis,
        distribution: distribution ?? version.distribution,
        headerTarget: version.basis === 'time' ? null : version.headerTarget,
        slices: slices.map(sliceInput),
        leaves,
        ratesAt,
        manualTargets: manualTargets(version, slices),
        concurrentProductsEnabled: concurrentProductsEnabled(),
        window: { start: window.from, end: window.to },
      }),
    );
  }

  /** Regenerates an open version's periods inside `manager`'s transaction (the version row is locked). */
  async regenerate(
    manager: EntityManager,
    versionId: string,
    distribution: Distribution | null,
  ): Promise<GenerationResult> {
    const version = await manager.findOneOrFail(PlanVersion, {
      where: { id: versionId },
      lock: { mode: 'pessimistic_write' },
    });
    if (
      version.approvalState !== 'draft' &&
      version.approvalState !== 'submitted'
    ) {
      throw conflict(
        'VERSION_NOT_DRAFT',
        'periods of an approved plan version are frozen; create a new version',
      );
    }
    const slices = await manager.find(PlanProductSlice, {
      where: { planVersionId: version.id },
      order: { position: 'ASC' },
    });
    const result = await this.compute(version, slices, distribution);
    await this.store(manager, version, result);
    Object.assign(version, {
      distribution: distribution ?? version.distribution,
      headerTarget:
        version.basis === 'quantity' && version.headerTarget !== null
          ? version.headerTarget
          : result.headerTarget,
      calendarVersionId: result.periods[0]?.leaf.calendarVersionId ?? null,
      periodsGeneratedAt: new Date(),
      generationWarnings: result.warnings,
      generationError: null,
    });
    await manager.save(version);
    return result;
  }

  /** Replaces the version's periods (chunked inserts). */
  private async store(
    manager: EntityManager,
    version: PlanVersion,
    result: GenerationResult,
  ): Promise<void> {
    await manager.delete(PlanPeriod, { planVersionId: version.id });
    const rows = periodRows(version, result);
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      await manager.insert(PlanPeriod, rows.slice(i, i + INSERT_CHUNK));
    }
  }
}

function sliceInput(slice: PlanProductSlice): SliceInput {
  return {
    key: slice.id,
    productId: slice.productId,
    stream: slice.stream,
    campaignFrom: slice.campaignFrom,
    campaignTo: slice.campaignTo,
    weight: slice.weight,
    target: slice.target,
  };
}

function manualTargets(
  version: PlanVersion,
  slices: readonly PlanProductSlice[],
): ManualTarget[] {
  return (version.manualTargets ?? []).map((entry) => ({
    sliceKey:
      slices[entry.slicePosition]?.id ?? `position-${entry.slicePosition}`,
    utcStart: new Date(entry.utcStart),
    target: entry.target,
  }));
}

function periodRows(
  version: PlanVersion,
  result: GenerationResult,
): Array<QueryDeepPartialEntity<PlanPeriod>> {
  return result.periods.map((period) => ({
    tenantId: version.tenantId,
    planVersionId: version.id,
    sliceId: period.sliceKey,
    unitId: version.unitId,
    shiftInstanceId: period.leaf.shiftInstanceId,
    calendarVersionId: period.leaf.calendarVersionId,
    utcStart: period.leaf.start,
    utcEnd: period.leaf.end,
    localDate: period.leaf.localDate,
    shiftName: period.leaf.shiftName,
    scheduledSeconds: period.scheduledSeconds,
    target: period.target,
    planningCapacityQty: period.planningCapacity,
    sustainedCapacityQty: period.sustainedCapacity,
    quantityUom: period.rates.quantityUom,
    profileId: period.rates.profileId,
    planningRateVersionId: period.rates.planning?.id ?? null,
    sustainedRateVersionId: period.rates.sustained?.id ?? null,
    isExcluded: period.leaf.isExcluded,
    exclusionKind: period.leaf.exclusionKind,
    createdBy: version.updatedBy,
    updatedBy: version.updatedBy,
  }));
}
