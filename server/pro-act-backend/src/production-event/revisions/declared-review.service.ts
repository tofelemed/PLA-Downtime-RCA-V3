import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { declaredIdentityGap } from '../../domain/events/declared-figures';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { ProductionEvent } from '../production-event.entity';
import { EventReviewItem, ReviewItemKind } from './event-review-item.entity';

/**
 * Declared mode: the review items a `production_loss` event raises when it is created by hand, changed by a
 * user or revised by its source. One open item per kind and event (a later check finding the same problem
 * keeps it). A duplicate declaration raises `duplicate_declared_loss` on both events. A source revision
 * whose figures now satisfy the identity resolves the open identity item as `accepted_source`.
 */
@Injectable()
export class DeclaredReviewService {
  constructor(private readonly policies: AccountingPoliciesService) {}

  async reviewIn(
    manager: EntityManager,
    event: ProductionEvent,
    sourceRevisionId: string | null,
  ): Promise<void> {
    if (event.physicalType !== 'production_loss' || !event.endTime) return;
    if (event.retractedAt) return;
    const others = await overlappingOthers(manager, event);
    const wanted = new Map<ReviewItemKind, boolean>([
      ['declared_identity_mismatch', await this.identityBroken(manager, event)],
      ['duplicate_declared_loss', others.length > 0],
      ['declared_window_mismatch', !(await windowIsPeriod(manager, event))],
    ]);
    for (const [kind, raised] of wanted) {
      if (raised) await openOnce(manager, event, kind, sourceRevisionId);
    }
    for (const other of others) {
      await openOnce(manager, other, 'duplicate_declared_loss', null);
    }
    if (!wanted.get('declared_identity_mismatch')) {
      await resolveOpen(manager, event.id, 'declared_identity_mismatch');
    }
  }

  private async identityBroken(
    manager: EntityManager,
    event: ProductionEvent,
  ): Promise<boolean> {
    if (!event.declaredFigures || !event.unitId || !event.tenantId)
      return false;
    const { lossAccounting } = await this.policies.resolveEngine(
      manager,
      { tenantId: event.tenantId, unitId: event.unitId },
      event.startTime,
    );
    return (
      Math.abs(declaredIdentityGap(event.declaredFigures)) >
      lossAccounting.identityTolerance
    );
  }
}

type ReviewedEvent = Pick<ProductionEvent, 'id' | 'tenantId'>;

/** The other live declared production loss events of the unit overlapping the event (IDX_production_events_declared). */
async function overlappingOthers(
  manager: EntityManager,
  event: ProductionEvent,
): Promise<ReviewedEvent[]> {
  const rows: Array<{ id: string; tenant_id: string }> = await manager.query(
    `SELECT "id", "tenant_id" FROM "production_events"
      WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "physical_type" = 'production_loss'
        AND "declared_figures" IS NOT NULL AND "retracted_at" IS NULL AND "id" <> $3
        AND "start_time" < $5 AND "end_time" > $4
      ORDER BY "start_time", "id" LIMIT 20`,
    [event.tenantId, event.unitId, event.id, event.startTime, event.endTime],
  );
  return rows.map((r) => ({ id: r.id, tenantId: r.tenant_id }));
}

/** True when a non-excluded period of the unit is exactly `[start, end)`. */
async function windowIsPeriod(
  manager: EntityManager,
  event: ProductionEvent,
): Promise<boolean> {
  const rows: unknown[] = await manager.query(
    `SELECT 1 FROM "production_periods"
      WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "utc_start" = $3 AND "utc_end" = $4
        AND "is_excluded" = false LIMIT 1`,
    [event.tenantId, event.unitId, event.startTime, event.endTime],
  );
  return rows.length > 0;
}

async function openOnce(
  manager: EntityManager,
  event: ReviewedEvent,
  kind: ReviewItemKind,
  sourceRevisionId: string | null,
): Promise<void> {
  const items = manager.getRepository(EventReviewItem);
  const open = await items.count({
    where: { eventId: event.id, kind, state: 'open' },
  });
  if (open > 0 || !event.tenantId) return;
  await items.save(
    items.create({
      tenantId: event.tenantId,
      eventId: event.id,
      kind,
      field: null,
      sourceRevisionId,
      codingRevisionId: null,
      state: 'open',
      createdBy: null,
      updatedBy: null,
    }),
  );
}

async function resolveOpen(
  manager: EntityManager,
  eventId: string,
  kind: ReviewItemKind,
): Promise<void> {
  await manager
    .getRepository(EventReviewItem)
    .update(
      { eventId, kind, state: 'open' },
      { state: 'accepted_source', resolvedAt: new Date() },
    );
}
