import { EntityManager } from 'typeorm';
import { enqueueOutbox, OutboxDraft } from '../common/outbox/outbox-writer';
import { ProductionProfile } from './entities/production-profile.entity';
import { RateImport } from './entities/rate-import.entity';
import { UnitProductRate } from './entities/unit-product-rate.entity';
import { ValuationRate } from './entities/valuation-rate.entity';

/** Message type: an approved baseline changed, so periods over the interval need recalculation (2.5). */
export const PROFILE_BASELINE_CHANGED = 'ProfileBaselineChanged';

export type BaselineChange = 'approved' | 'superseded' | 'retired';

type Changed = ProductionProfile | UnitProductRate | ValuationRate;

function subjectOf(row: Changed): Record<string, unknown> {
  if (row instanceof ProductionProfile) {
    return {
      subject: 'profile',
      unitId: row.unitId,
      productId: row.productId,
      operatingMode: row.operatingMode,
    };
  }
  if (row instanceof UnitProductRate) {
    return { subject: 'rate', rateKind: row.rateKind };
  }
  return {
    subject: 'valuation_rate',
    basis: row.basis,
    impactCodeId: row.impactCodeId,
  };
}

function aggregateOf(row: Changed): string {
  if (row instanceof ProductionProfile) return row.id;
  if (row instanceof UnitProductRate) return row.profileId;
  return row.profileId ?? row.impactCodeId ?? row.id;
}

/**
 * Outbox messages (FND02, committed with the change) for approved-baseline changes of plan 2.2: the
 * approval, retirement or supersede of a profile, rate or valuation rate, with the interval it covers.
 * Consumers (period recalculation in 2.5, realtime in 2.9) re-read the row; the payload only locates it.
 */
export async function recordBaselineChanges(
  manager: EntityManager,
  changes: ReadonlyArray<{ row: Changed; change: BaselineChange }>,
): Promise<void> {
  const drafts: OutboxDraft[] = changes.map(({ row, change }) => ({
    tenantId: row.tenantId,
    aggregateType: 'production_profile',
    aggregateId: aggregateOf(row),
    type: PROFILE_BASELINE_CHANGED,
    version: row.rowVersion,
    payload: {
      change,
      id: row.id,
      version: row.version,
      ...subjectOf(row),
      effectiveFrom: row.effectiveFrom.toISOString(),
      effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
    },
  }));
  await enqueueOutbox(manager, drafts);
}

/** One message per applied import document: the profiles whose rates of that kind changed. */
export async function recordImportApplied(
  manager: EntityManager,
  job: RateImport,
  profileIds: readonly string[],
): Promise<void> {
  await enqueueOutbox(manager, [
    {
      tenantId: job.tenantId,
      aggregateType: 'rate_import',
      aggregateId: job.id,
      type: PROFILE_BASELINE_CHANGED,
      version: job.revision,
      payload: {
        change: 'imported',
        subject: 'rate_import',
        importId: job.id,
        kind: job.kind,
        externalId: job.externalId,
        revision: job.revision,
        profileIds: [...profileIds],
      },
    },
  ]);
}
