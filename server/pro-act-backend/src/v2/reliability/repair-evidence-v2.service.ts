import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import {
  repairEvidence,
  RepairOperation,
} from '../../domain/reliability/repair-evidence';
import { periodScopeUnits } from '../../periods/period-scope';
import { notFound } from '../../profiles/profile-errors';
import { ACTIVE_REPAIR_KINDS } from '../../reliability/entities/work-order-operation.entity';
import { toIso } from './reliability-v2-common';

/** `GET /v2/work-order-operations/repair-evidence`: the stop's active-repair evidence (SME D10). */
export interface RepairEvidenceV2View {
  eventId: string;
  /** every CMMS operation linked to the stop (any revision of it) */
  operations: number;
  /** diagnosis, repair and test operations: the active-repair evidence */
  activeOperations: number;
  /** active operations still running (the repair time is then not known yet) */
  openOperations: number;
  /** Σ waiting for parts, permit or crew inside the active operations (s) */
  waitingSeconds: number;
  /** active repair (s) as the KPI `mttr` ("Mean active repair time") counts it; null with `reason` */
  activeRepairSeconds: number | null;
  repairStart: string | null;
  repairEnd: string | null;
  reason: 'no_operations' | 'operation_open' | null;
}

interface OperationRow {
  operation_kind: RepairOperation['kind'];
  started_at: Date;
  ended_at: Date | null;
  waiting_seconds: number;
}

/** Operations linked to any revision of the stop (as the KPI loader joins them), the caller's units only. */
const OPERATIONS_SQL = `SELECT o."operation_kind", o."started_at", o."ended_at", o."waiting_seconds"
  FROM "work_order_operations" o
  JOIN "production_events" e ON e."id" = o."event_id" AND e."tenant_id" = $1::varchar AND e."unit_id" = o."unit_id"
 WHERE o."tenant_id" = $1::uuid AND e."occurrence_id" = $2::uuid
 ORDER BY o."started_at", o."id"`;

/**
 * SME D10: the repair evidence of one stop from its CMMS operations — active repair (diagnosis + repair +
 * test, overlaps once, minus waiting) as the KPI run counts it, or the reason there is none. The stop must
 * be of the caller's units (404 otherwise).
 */
@Injectable()
export class RepairEvidenceV2Service {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async forEvent(
    context: RequestContext,
    eventId: string,
  ): Promise<RepairEvidenceV2View> {
    const tenantId = requireTenantId(context);
    const occurrenceId = await this.occurrenceOf(context, tenantId, eventId);
    const rows = await this.manager.query<OperationRow[]>(OPERATIONS_SQL, [
      tenantId,
      occurrenceId,
    ]);
    const operations = rows.map((r) => ({
      kind: r.operation_kind,
      start: new Date(r.started_at),
      end: r.ended_at ? new Date(r.ended_at) : null,
      waitingSeconds: r.waiting_seconds,
    }));
    const active = operations.filter((o) => ACTIVE_REPAIR_KINDS.has(o.kind));
    const open = active.filter((o) => o.end === null).length;
    const evidence = repairEvidence(operations);
    return {
      eventId,
      operations: operations.length,
      activeOperations: active.length,
      openOperations: open,
      waitingSeconds: active.reduce((sum, o) => sum + o.waitingSeconds, 0),
      activeRepairSeconds: evidence?.activeRepairSeconds ?? null,
      repairStart: evidence ? toIso(evidence.repairStart) : null,
      repairEnd: evidence ? toIso(evidence.repairEnd) : null,
      reason: evidence
        ? null
        : active.length === 0
          ? 'no_operations'
          : 'operation_open',
    };
  }

  private async occurrenceOf(
    context: RequestContext,
    tenantId: string,
    eventId: string,
  ): Promise<string> {
    const [row] = await this.manager.query<Array<{ occurrence_id: string }>>(
      `SELECT "occurrence_id" FROM "production_events"
        WHERE "id" = $1 AND "tenant_id" = $2 AND ($3::uuid[] IS NULL OR "unit_id" = ANY($3::uuid[]))`,
      [eventId, tenantId, periodScopeUnits(context)],
    );
    if (!row) throw notFound('Production event');
    return row.occurrence_id;
  }
}
