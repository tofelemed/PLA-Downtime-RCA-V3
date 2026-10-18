import { EntityManager } from 'typeorm';
import { parseArray, text } from './rca-json-read';

/** An action implementing a case recommendation (item 5), as the case view lists it. */
export interface RecommendationActionRef {
  id: string;
  title: string;
  status: string;
}

/** Per recommendation id, the case's actions that implement it (oldest first), in one query. */
export async function recommendationActions(
  manager: EntityManager,
  tenantId: string,
  rcaId: string,
): Promise<Map<string, RecommendationActionRef[]>> {
  const rows: Array<RecommendationActionRef & { recommendation_id: string }> =
    await manager.query(
      `SELECT "id", "title", "status"::text AS "status", "recommendation_id"
         FROM "rca_actions"
        WHERE "tenant_id" = $1 AND "rca_id" = $2 AND "recommendation_id" IS NOT NULL
        ORDER BY "created_at", "id"`,
      [tenantId, rcaId],
    );
  const byRecommendation = new Map<string, RecommendationActionRef[]>();
  for (const { recommendation_id: key, ...action } of rows)
    byRecommendation.set(key, [...(byRecommendation.get(key) ?? []), action]);
  return byRecommendation;
}

/** Recommendation statuses that are already final (the case form's `Completed` / `Cancelled`). */
const FINAL = new Set(['Completed', 'Cancelled']);

/**
 * The status a recommendation item takes when its case closes (Marun E2E, engineering default): every
 * implementing action done (cancelled ones aside) → `Completed`; every one cancelled → `Cancelled`; no
 * implementing action, or a final status already → unchanged (null).
 */
export function closedRecommendationStatus(
  status: string | null,
  actions: readonly RecommendationActionRef[],
): 'Completed' | 'Cancelled' | null {
  if (status && FINAL.has(status)) return null;
  if (actions.length === 0) return null;
  const live = actions.filter((action) => action.status !== 'cancelled');
  if (live.length === 0) return 'Cancelled';
  return live.every((action) => action.status === 'done') ? 'Completed' : null;
}

/** The case's recommendation items (stored JSON text) with their statuses at closure; null when unchanged. */
export async function recommendationsAtClosure(
  manager: EntityManager,
  rca: { tenantId?: string | null; id: string; recommendations?: string },
): Promise<string | null> {
  const items = parseArray(rca.recommendations);
  if (items.length === 0 || !rca.tenantId) return null;
  const byRecommendation = await recommendationActions(
    manager,
    rca.tenantId,
    rca.id,
  );
  let changed = false;
  const next = items.map((item) => {
    const id = text(item.id);
    const target = id
      ? closedRecommendationStatus(
          text(item.status),
          byRecommendation.get(id) ?? [],
        )
      : null;
    if (!target) return item;
    changed = true;
    return { ...item, status: target };
  });
  return changed ? JSON.stringify(next) : null;
}
