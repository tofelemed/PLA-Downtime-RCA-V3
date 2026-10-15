import { EntityManager } from 'typeorm';
import { NotificationKind } from './entities/user-notification.entity';

/** One notification to insert: who, which kind, the idempotency key, the period and the structured detail. */
export interface NotificationRow {
  user_id: string;
  kind: NotificationKind;
  dedupe_key: string;
  entity_id: string;
  detail: Record<string, unknown>;
}

/** Period columns every SLA notification names (the client renders them in plant time). */
export interface PeriodRef {
  id: string;
  unit_id: string;
  unit_name: string | null;
  plan_id: string | null;
  local_date: string;
  shift_name: string | null;
}

export function periodDetail(row: PeriodRef): Record<string, unknown> {
  return {
    periodId: row.id,
    unitId: row.unit_id,
    unitName: row.unit_name,
    planId: row.plan_id,
    localDate: row.local_date,
    shiftName: row.shift_name,
  };
}

/** Holders of a role per unit, read once per role and unit within one run. */
export class HolderCache {
  private readonly cache = new Map<string, string[]>();

  constructor(
    private readonly load: (role: string, unitId: string) => Promise<string[]>,
  ) {}

  async of(role: string, unitId: string): Promise<string[]> {
    const key = `${role}:${unitId}`;
    const found = this.cache.get(key);
    if (found) return found;
    const users = await this.load(role, unitId);
    this.cache.set(key, users);
    return users;
  }
}

/**
 * Inserts the rows of production periods; a key the user already has is skipped (`UQ_user_notifications_user_key`,
 * ON CONFLICT DO NOTHING), so reruns and concurrent workers add nothing. Returns how many were new.
 */
export async function insertNotifications(
  manager: EntityManager,
  tenantId: string,
  rows: readonly NotificationRow[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const inserted: unknown[] = await manager.query(
    `INSERT INTO "user_notifications" ("tenant_id", "row_version", "user_id", "kind", "dedupe_key",
            "entity_type", "entity_id", "detail")
     SELECT $1, 1, x."user_id", x."kind", x."dedupe_key", 'production_period', x."entity_id", x."detail"
       FROM jsonb_to_recordset($2::jsonb)
         AS x("user_id" uuid, "kind" text, "dedupe_key" text, "entity_id" uuid, "detail" jsonb)
     ON CONFLICT ("tenant_id", "user_id", "dedupe_key") DO NOTHING
     RETURNING "id"`,
    [tenantId, JSON.stringify(rows)],
  );
  return inserted.length;
}
