import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Dec, toDec, ZERO } from '../domain/actuals/decimal';
import { parseDeclaredFigures } from '../domain/events/declared-figures';
import { LossEventCodingCounts } from '../domain/reconciliation/declared-coding-gate';
import { isDeclaredConfirmed } from '../domain/reconciliation/declared-confirmation';

/**
 * The unit's live production loss events overlapping `[$3, $4)`, by coding. The declared-figures predicate
 * matches the partial index IDX_production_events_declared (tenant, unit, start_time).
 */
const COUNTS_SQL = `SELECT count(*)::int AS "events",
       count(*) FILTER (WHERE e."reason_code_id" IS NOT NULL)::int AS "coded",
       count(*) FILTER (WHERE e."reason_code_id" IS NULL AND e."investigation_pending")::int AS "pending",
       count(*) FILTER (WHERE e."verified_at" IS NOT NULL)::int AS "verified",
       coalesce(sum(greatest(e."quantity", 0)), 0)::text AS "shortfall",
       coalesce(sum(greatest(e."quantity", 0)) FILTER (WHERE e."reason_code_id" IS NOT NULL), 0)::text AS "coded_shortfall"
  FROM "production_events" e
 WHERE e."tenant_id" = $1 AND e."unit_id" = $2
   AND e."declared_figures" IS NOT NULL AND e."retracted_at" IS NULL
   AND e."physical_type" = 'production_loss' AND e."physical_state" IN ('open', 'closed')
   AND e."start_time" < $4 AND (e."end_time" IS NULL OR e."end_time" > $3)`;

/**
 * The event the period accounts for: window equal to the period's, earliest start, then earliest recorded,
 * then lowest id (as the engine picks it, `chooseDeclaredEvent`).
 */
const PERIOD_EVENT_SQL = `SELECT e."source_kind"::text AS "source_kind", e."declared_figures"
  FROM "production_events" e
 WHERE e."tenant_id" = $1 AND e."unit_id" = $2
   AND e."declared_figures" IS NOT NULL AND e."retracted_at" IS NULL
   AND e."physical_type" = 'production_loss' AND e."physical_state" IN ('open', 'closed')
   AND e."start_time" = $3 AND e."end_time" = $4
 ORDER BY e."start_time", e."created_at", e."id" LIMIT 1`;

export interface LossWindow {
  tenantId: string;
  unitId: string;
  from: Date;
  to: Date;
}

/** Production loss events of a unit overlapping `[from, to)` (a period or a production day) by coding. */
export async function lossEventCodingCounts(
  manager: EntityManager,
  window: LossWindow,
): Promise<LossEventCodingCounts> {
  const [row]: Array<{
    events: number;
    coded: number;
    pending: number;
    verified: number;
    shortfall: string;
    coded_shortfall: string;
  }> = await manager.query(COUNTS_SQL, [
    window.tenantId,
    window.unitId,
    window.from,
    window.to,
  ]);
  return {
    events: row?.events ?? 0,
    coded: row?.coded ?? 0,
    investigationPending: row?.pending ?? 0,
    verified: row?.verified ?? 0,
    shortfall: toDec(row?.shortfall) ?? new Dec(0),
    codedShortfall: toDec(row?.coded_shortfall) ?? ZERO,
  };
}

/** 409 DECLARED_NOT_CONFIRMED (D8): OT has not confirmed the production loss the period is booked on. */
export function declaredNotConfirmed(status: string | null): ConflictException {
  return new ConflictException({
    code: 'DECLARED_NOT_CONFIRMED',
    message: "OT has not confirmed this day's production loss yet",
    details: { sourceStatus: status },
  });
}

/** D8: in declared mode the period's production loss event must be confirmed before approval. */
export async function assertDeclaredConfirmed(
  manager: EntityManager,
  window: LossWindow,
): Promise<void> {
  const [row]: Array<{ source_kind: string; declared_figures: unknown }> =
    await manager.query(PERIOD_EVENT_SQL, [
      window.tenantId,
      window.unitId,
      window.from,
      window.to,
    ]);
  const status = row
    ? (parseDeclaredFigures(row.declared_figures)?.sourceStatus ?? null)
    : null;
  if (!row || !isDeclaredConfirmed(row.source_kind, status)) {
    throw declaredNotConfirmed(status);
  }
}
