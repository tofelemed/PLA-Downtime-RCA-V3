import { MigrationInterface, QueryRunner } from 'typeorm';

/** Recommendation statuses that are already final (the case form's `Completed` / `Cancelled`). */
const FINAL = new Set(['Completed', 'Cancelled']);

type Item = Record<string, unknown>;

const isItem = (value: unknown): value is Item =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseItems(stored: string): unknown[] | null {
  try {
    const value: unknown = JSON.parse(stored);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * The closure rule of DECISIONS "Marun E2E RCA follow-up fixes" (`closedRecommendationStatus`), copied so this
 * repair keeps its meaning if the rule later changes: every implementing action done (cancelled ones aside)
 * → Completed; every one cancelled → Cancelled; none, or a final status already → unchanged (null).
 */
function statusAtClosure(
  status: unknown,
  actions: readonly string[],
): 'Completed' | 'Cancelled' | null {
  if (typeof status === 'string' && FINAL.has(status)) return null;
  if (actions.length === 0) return null;
  const live = actions.filter((action) => action !== 'cancelled');
  if (live.length === 0) return 'Cancelled';
  return live.every((action) => action === 'done') ? 'Completed' : null;
}

/**
 * Data repair (Marun regression, DECISIONS 2026-10-18): the closure rule for recommendations runs only when
 * closure is approved, so investigations closed before it existed still list their recommendations as
 * "Open". This applies the rule once to the recommendations of every case already `Closed`, from the
 * statuses of their implementing actions now. No audit row is written (a schema-time repair, recorded in
 * DECISIONS); `row_version` moves so open editors reload. Idempotent. `down` is a no-op: the earlier
 * statuses were wrong and which items held them is not recorded.
 */
export class CloseRecommendationsOfClosedCases1794221700000
  implements MigrationInterface
{
  name = 'CloseRecommendationsOfClosedCases1794221700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cases = (await queryRunner.query(
      `SELECT "id", "recommendations" FROM "rcas"
        WHERE "status" = 'Closed' AND "recommendations" IS NOT NULL AND "recommendations" <> ''`,
    )) as Array<{ id: string; recommendations: string }>;
    for (const rca of cases) {
      const next = await this.repaired(queryRunner, rca);
      if (next === null) continue;
      await queryRunner.query(
        `UPDATE "rcas" SET "recommendations" = $2, "row_version" = "row_version" + 1, "updated_at" = now()
          WHERE "id" = $1`,
        [rca.id, next],
      );
    }
  }

  public async down(): Promise<void> {
    // intentionally empty: see the class comment
  }

  /** The case's recommendations with the closure statuses applied; null when nothing changes. */
  private async repaired(
    queryRunner: QueryRunner,
    rca: { id: string; recommendations: string },
  ): Promise<string | null> {
    const items = parseItems(rca.recommendations);
    if (!items || items.length === 0) return null;
    const rows = (await queryRunner.query(
      `SELECT "recommendation_id", "status"::text AS "status" FROM "rca_actions"
        WHERE "rca_id" = $1 AND "recommendation_id" IS NOT NULL`,
      [rca.id],
    )) as Array<{ recommendation_id: string; status: string }>;
    const byRecommendation = new Map<string, string[]>();
    for (const row of rows)
      byRecommendation.set(row.recommendation_id, [
        ...(byRecommendation.get(row.recommendation_id) ?? []),
        row.status,
      ]);
    let changed = false;
    const next = items.map((item) => {
      if (!isItem(item) || typeof item.id !== 'string') return item;
      const target = statusAtClosure(
        item.status,
        byRecommendation.get(item.id) ?? [],
      );
      if (!target) return item;
      changed = true;
      return { ...item, status: target };
    });
    return changed ? JSON.stringify(next) : null;
  }
}
