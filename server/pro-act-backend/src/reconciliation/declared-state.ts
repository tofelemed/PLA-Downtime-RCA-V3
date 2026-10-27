import { EntityManager } from 'typeorm';
import { Dec, toDec } from '../domain/actuals/decimal';
import { CalculationRun } from '../accounting/entities/calculation-run.entity';
import {
  LossBasis,
  lossBasisForUnit,
  parseLossAccounting,
} from '../periods/loss-accounting-policy';
import { AccountingPolicy } from '../periods/entities/accounting-policy.entity';
import { ReconciliationLine } from './entities/reconciliation-line.entity';

/**
 * The loss basis the run was calculated with, from the `loss_accounting` version its policy snapshot
 * names — never re-resolved, so a policy change after the run cannot desynchronise the gates from the
 * figures. A run without that version (older than declared mode) or without a run is `computed`, and so
 * is a run of a unit that is not the version's accounting unit (the engine accounted it computed).
 */
export async function lossBasisOfRun(
  manager: EntityManager,
  run: CalculationRun | null,
  unitId: string,
): Promise<LossBasis> {
  const ref = run?.policyVersions.find((p) => p.kind === 'loss_accounting');
  if (!ref) return 'computed';
  const stored = await manager.findOneBy(AccountingPolicy, { id: ref.id });
  return stored
    ? lossBasisForUnit(parseLossAccounting(stored.body), unitId)
    : 'computed';
}

/** Shortfall (event quantity) of the `production_loss` events the lines cite, by event id. */
export async function declaredShortfallsOf(
  manager: EntityManager,
  lines: readonly ReconciliationLine[],
): Promise<Map<string, Dec>> {
  const ids = [
    ...new Set(lines.flatMap((l) => l.evidence.map((e) => e.eventId))),
  ];
  if (ids.length === 0) return new Map();
  const rows = await manager.query<Array<{ id: string; quantity: string }>>(
    `SELECT "id", "quantity"::text AS "quantity" FROM "production_events"
      WHERE "id" = ANY($1::uuid[]) AND "physical_type" = 'production_loss' AND "quantity" IS NOT NULL`,
    [ids],
  );
  return new Map(
    rows.flatMap((r): Array<[string, Dec]> => {
      const shortfall = toDec(r.quantity);
      return shortfall ? [[r.id, shortfall]] : [];
    }),
  );
}
