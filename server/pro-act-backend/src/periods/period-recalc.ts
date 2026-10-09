import { EntityManager } from 'typeorm';
import { enqueueOutbox } from '../common/outbox/outbox-writer';

/** Message type: the actuals of periods overlapping a window must be recalculated (plan 2.4 step 5). */
export const PERIOD_RECALCULATE_REQUESTED = 'PeriodRecalculateRequested';

export interface RecalculationRequest {
  tenantId: string;
  /** null = every unit the requester may affect (`scopeUnitIds`, null = tenant-wide) */
  unitIds: string[] | null;
  from: Date;
  /** null = up to now (an open event) */
  to: Date | null;
  reason: string;
  scopeUnitIds: string[] | null;
  requestedBy: string | null;
}

/** Payload of `PeriodRecalculateRequested` (ISO instants). */
export interface RecalculationPayload {
  unitIds: string[] | null;
  from: string;
  to: string | null;
  reason: string;
  scopeUnitIds: string[] | null;
  requestedBy: string | null;
}

/**
 * Writes `PeriodRecalculateRequested` with the caller's transaction (FND02): output events changed, an
 * adjustment was approved, an external report was imported or the accounting baseline changed. The 2.4
 * consumer turns it into leased recompute jobs per period; 2.5 takes it over to run actuals inside its
 * calculation run (actuals first).
 */
export async function requestRecalculation(
  manager: EntityManager,
  request: RecalculationRequest,
): Promise<void> {
  const payload: RecalculationPayload = {
    unitIds: request.unitIds,
    from: request.from.toISOString(),
    to: request.to ? request.to.toISOString() : null,
    reason: request.reason,
    scopeUnitIds: request.scopeUnitIds,
    requestedBy: request.requestedBy,
  };
  await enqueueOutbox(manager, [
    {
      tenantId: request.tenantId,
      aggregateType: 'production_period_window',
      aggregateId: request.tenantId,
      type: PERIOD_RECALCULATE_REQUESTED,
      payload: { ...payload },
    },
  ]);
}
