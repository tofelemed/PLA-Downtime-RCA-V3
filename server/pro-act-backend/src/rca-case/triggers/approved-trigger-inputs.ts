import { EntityManager } from 'typeorm';
import { Dec, formatDec } from '../../domain/actuals/decimal';
import { approvedImpact } from '../approved-impact';

/** Cause events of the lines approved in a revision (approved line set; the run's lines before VA-01b). */
export async function approvedCauseEvents(
  manager: EntityManager,
  input: { tenantId: string; revisionId: string },
): Promise<string[]> {
  const rows: Array<{ id: string }> = await manager.query(
    `SELECT DISTINCT a."cause_event_id"::text AS "id" FROM "approved_loss_lines" a
      WHERE a."tenant_id" = $1 AND a."revision_id" = $2 AND a."cause_event_id" IS NOT NULL
     UNION
     SELECT DISTINCT l."cause_event_id"::text FROM "loss_lines" l
       JOIN "accounting_revisions" ar ON ar."id" = $2 AND ar."tenant_id" = $1 AND l."run_id" = ar."current_run_id"
      WHERE l."tenant_id" = $1 AND l."cause_event_id" IS NOT NULL AND l."state" = 'active'
        AND NOT EXISTS (SELECT 1 FROM "approved_loss_lines" x WHERE x."revision_id" = $2)`,
    [input.tenantId, input.revisionId],
  );
  return rows.map((row) => row.id);
}

/** Approved value and lost quantity per unit of measure of one event (ledger, approved revisions only). */
export async function approvedEventFigures(
  manager: EntityManager,
  input: { tenantId: string; eventId: string },
): Promise<{
  values: Array<{ currency: string; amount: string | null }>;
  lost: Array<{ uom: string | null; quantity: string }>;
}> {
  const impact = await approvedImpact(manager, input.tenantId, {
    eventIds: [input.eventId],
  });
  const byUom = new Map<string | null, Dec>();
  for (const row of impact.quantities) {
    byUom.set(
      row.uom,
      (byUom.get(row.uom) ?? new Dec(0)).plus(new Dec(row.quantity)),
    );
  }
  return {
    values: impact.values.map((value) => ({
      currency: value.currency,
      amount: value.amount,
    })),
    lost: [...byUom.entries()].map(([uom, quantity]) => ({
      uom,
      quantity: formatDec(quantity),
    })),
  };
}

/**
 * The unit's planned quantity of the operational day of a period (D17 "1 % of the unit's daily planned
 * tonnes"): the plan-ledger targets of every period of that unit and local date, each from its latest
 * revision's run, per unit of measure. Empty when no plan is known (the quantity trigger cannot compare).
 */
export async function dailyPlanOf(
  manager: EntityManager,
  input: { tenantId: string; periodId: string },
): Promise<Array<{ uom: string | null; quantity: string }>> {
  const rows: Array<{ uom: string | null; quantity: string }> =
    await manager.query(
      `SELECT t."uom", sum(t."target_qty")::text AS "quantity"
       FROM "production_periods" anchor
       JOIN "production_periods" p ON p."tenant_id" = anchor."tenant_id" AND p."unit_id" = anchor."unit_id"
                                  AND p."local_date" = anchor."local_date"
       JOIN LATERAL (SELECT ar."current_run_id" FROM "accounting_revisions" ar
                      WHERE ar."tenant_id" = $1 AND ar."period_id" = p."id"
                      ORDER BY ar."revision" DESC LIMIT 1) r ON true
       JOIN "period_ledger_totals" t ON t."run_id" = r."current_run_id" AND t."period_id" = p."id"
                                    AND t."ledger" = 'plan' AND t."target_qty" IS NOT NULL
      WHERE anchor."tenant_id" = $1 AND anchor."id" = $2
      GROUP BY t."uom"`,
      [input.tenantId, input.periodId],
    );
  return rows;
}
