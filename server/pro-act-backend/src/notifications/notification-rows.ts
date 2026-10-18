import { EntityManager } from 'typeorm';
import { workItemKeyOf } from '../domain/notifications/work-item-key';
import { NotificationKind } from './entities/user-notification.entity';

/** One notification to insert: who, which kind, the idempotency key, the record it concerns and the structured detail. */
export interface NotificationRow {
  user_id: string;
  kind: NotificationKind;
  dedupe_key: string;
  /** what `entity_id` names; a production period when absent */
  entity_type?: string;
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
 * Inserts the rows (a production period unless the row names another record), each with the shared work item
 * it is about (`workItemKeyOf`). A key the user already has is skipped (`UQ_user_notifications_user_key`), so
 * reruns and concurrent workers add nothing — unless that notification was resolved and its work is owed
 * again (e.g. a stop's reason was cleared): then it is re-opened as new and unread. Returns how many were
 * new or re-opened.
 */
export async function insertNotifications(
  manager: EntityManager,
  tenantId: string,
  rows: readonly NotificationRow[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const keyed = rows.map((row) => ({
    ...row,
    work_item_key: workItemKeyOf(row.kind, row.dedupe_key),
  }));
  const inserted: unknown[] = await manager.query(
    `INSERT INTO "user_notifications" ("tenant_id", "row_version", "user_id", "kind", "dedupe_key",
            "entity_type", "entity_id", "detail", "work_item_key")
     SELECT $1, 1, x."user_id", x."kind", x."dedupe_key", coalesce(x."entity_type", 'production_period'),
            x."entity_id", x."detail", x."work_item_key"
       FROM jsonb_to_recordset($2::jsonb)
         AS x("user_id" uuid, "kind" text, "dedupe_key" text, "entity_type" text, "entity_id" uuid, "detail" jsonb,
              "work_item_key" text)
     ON CONFLICT ("tenant_id", "user_id", "dedupe_key") DO UPDATE
        SET "resolved_at" = NULL, "resolution" = NULL, "read_at" = NULL, "detail" = EXCLUDED."detail",
            "created_at" = now(), "updated_at" = now(), "row_version" = "user_notifications"."row_version" + 1
      WHERE "user_notifications"."resolved_at" IS NOT NULL
     RETURNING "id"`,
    [tenantId, JSON.stringify(keyed)],
  );
  return inserted.length;
}
