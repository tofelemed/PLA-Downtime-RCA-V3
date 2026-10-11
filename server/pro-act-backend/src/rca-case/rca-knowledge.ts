import { EntityManager } from 'typeorm';
import { RCA } from '../rca/rca.entity';
import { readRecommendations } from './rca-case-json';
import { caseFootprint } from './rca-recurrence';

/**
 * Closing a case feeds the knowledge base (plan 3.9 step 4, the gap noted in the application guide):
 * one entry per case, created on the first close and updated on a later one. The entry is unpublished
 * (a person publishes it) and is attributed to whoever closed the case; nothing in it is generated —
 * it carries the case's own title, root cause, recommendations and linked units / assets.
 */
export async function upsertKnowledgeEntry(
  manager: EntityManager,
  input: { rca: RCA; closedBy: string | null; closedAt: Date },
): Promise<string> {
  const { rca } = input;
  const tenantId = rca.tenantId ?? '';
  const footprint = await caseFootprint(manager, tenantId, rca.id);
  const recommendations = readRecommendations(rca.recommendations).map(
    (item) => item.title,
  );
  const values = [
    tenantId,
    rca.id,
    rca.title.slice(0, 255),
    rca.description ?? null,
    rca.rootCause ?? null,
    JSON.stringify(recommendations),
    rca.unitId ?? footprint.unitIds[0] ?? null,
    rca.assetId ?? footprint.assetIds[0] ?? null,
    input.closedBy,
    input.closedAt.toISOString(),
    JSON.stringify([rca.id]),
  ];
  const existing: Array<{ id: string }> = await manager.query(
    `SELECT "id" FROM "rca_knowledge_base" WHERE "tenant_id" = $1 AND "rca_id" = $2 ORDER BY "created_at" LIMIT 1 FOR UPDATE`,
    [tenantId, rca.id],
  );
  if (existing[0]) {
    await manager.query(
      `UPDATE "rca_knowledge_base" SET "title" = $3, "description" = $4, "root_cause" = $5, "recommendations" = $6,
              "unit_id" = $7, "asset_id" = $8, "author" = $9, "closed_date" = $10, "related_rcas" = $11, "updated_at" = now(),
              "row_version" = "row_version" + 1
        WHERE "id" = $12 AND "tenant_id" = $1 AND "rca_id" = $2`,
      [...values, existing[0].id],
    );
    return existing[0].id;
  }
  const inserted: Array<{ id: string }> = await manager.query(
    `INSERT INTO "rca_knowledge_base" ("tenant_id", "rca_id", "title", "description", "root_cause", "recommendations",
            "unit_id", "asset_id", "author", "closed_date", "related_rcas", "is_published")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false) RETURNING "id"`,
    values,
  );
  return inserted[0].id;
}
