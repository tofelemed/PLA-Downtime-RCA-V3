import { EntityManager } from 'typeorm';
import { RcaStatus, statusOf } from '../domain/rca/case-workflow';
import { RcaCause } from '../rca/entities/rca-cause.entity';
import { RCA } from '../rca/rca.entity';
import { RcaCaseCauseV2UpdateDto } from '../v2/rca/rca-case-causes-v2.dto';
import { readEvidence, readLogicTree } from './rca-case-json';
import { invalidBody, invalidReference } from './rca-scope';

/** Statuses in which the causes are frozen: the closure is under review or decided (reopen to change). */
export const CAUSES_LOCKED_STATUSES: readonly RcaStatus[] = [
  'Closure Review',
  'Closed',
];

/** 422 CAUSES_LOCKED once closure is requested: the reviewer judges a fixed set of causes. */
export function assertCausesOpen(rca: RCA): void {
  if (!CAUSES_LOCKED_STATUSES.includes(statusOf(rca.status))) return;
  throw invalidBody(
    'CAUSES_LOCKED',
    'causes',
    'causes cannot change while the closure is reviewed or after it was approved (reopen the case)',
  );
}

/** Columns of `rca_causes` a body sets (undefined = untouched). */
export function causeColumns(body: RcaCaseCauseV2UpdateDto): Partial<RcaCause> {
  const columns: Partial<RcaCause> = {};
  if (body.kind !== undefined) columns.kind = body.kind;
  if (body.causeCodeId !== undefined) columns.causeCodeId = body.causeCodeId;
  if (body.statement !== undefined) columns.statement = body.statement.trim();
  if (body.evidenceIds !== undefined)
    columns.evidenceIds = [...new Set(body.evidenceIds)];
  if (body.nodeIds !== undefined) columns.nodeIds = [...new Set(body.nodeIds)];
  return columns;
}

/**
 * A newly assigned cause code is a cause of the plant's catalogue (422 INVALID_REFERENCE) that is not
 * retired (422 CAUSE_CODE_RETIRED); a cause keeping the code it already had stays valid after retirement.
 */
export async function assertCauseCode(
  manager: EntityManager,
  tenantId: string,
  change: { next: string | null | undefined; current: string | null },
): Promise<void> {
  const { next, current } = change;
  if (!next || next === current) return;
  const rows: Array<{ is_active: boolean }> = await manager.query(
    `SELECT "is_active" FROM "rca_cause_codes" WHERE "id" = $1 AND "tenant_id" = $2`,
    [next, tenantId],
  );
  if (rows.length === 0) throw invalidReference('causeCodeId');
  if (!rows[0].is_active) {
    throw invalidBody(
      'CAUSE_CODE_RETIRED',
      'causeCodeId',
      'this cause is retired in the cause library; choose an active cause',
    );
  }
}

/** Evidence and logic-tree ids must be items of the case (422 INVALID_REFERENCE). */
export function assertCaseItems(rca: RCA, cause: Partial<RcaCause>): void {
  const evidence = new Set(readEvidence(rca.evidence).map((item) => item.id));
  if ((cause.evidenceIds ?? []).some((id) => !evidence.has(id)))
    throw invalidReference('evidenceIds');
  const nodes = new Set(readLogicTree(rca.logicTree).map((node) => node.id));
  if ((cause.nodeIds ?? []).some((id) => !nodes.has(id)))
    throw invalidReference('nodeIds');
}

/** Item 7 close gate input: root causes of the case linked to the catalogue. */
export async function codedRootCauses(
  manager: EntityManager,
  rca: RCA,
): Promise<number> {
  const rows: Array<{ n: number }> = await manager.query(
    `SELECT count(*)::int AS "n" FROM "rca_causes"
      WHERE "tenant_id" = $1 AND "rca_id" = $2 AND "kind" = 'root' AND "cause_code_id" IS NOT NULL`,
    [rca.tenantId, rca.id],
  );
  return rows[0]?.n ?? 0;
}
