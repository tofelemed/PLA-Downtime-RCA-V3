import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { enqueueOutbox } from '../common/outbox/outbox-writer';
import {
  REFRESH_STATEMENTS,
  RESOLUTION_STATEMENTS,
} from './work-item-resolution-sql';

/** Outbox type of the realtime hint after resolution: every bell of the plant refetches (no content is pushed). */
export const NOTIFICATIONS_RESOLVED = 'UserNotificationsResolved';

/** UPDATE ... RETURNING answers [rows, rowCount] through TypeORM's postgres driver. */
function updatedCount(result: unknown): number {
  if (!Array.isArray(result)) return 0;
  if (result.length === 2 && Array.isArray(result[0])) {
    return typeof result[1] === 'number' ? result[1] : result[0].length;
  }
  return result.length;
}

/**
 * Shared work items (owner 18 Oct): a reminder goes to several people, but the work is one. Once anyone
 * does it — codes the stops, ends the stop, finishes the action or task, submits or decides the period —
 * every recipient's open notification of that work item is resolved at once: it leaves the bell's active
 * list and the unread count and stays readable as history (`state=resolved`). Set-based per plant and
 * idempotent; called after the domain messages that can finish work (see `WorkItemResolutionConsumer`) and
 * by a periodic sweep (`WorkItemResolutionJob`) for work changed without one.
 */
@Injectable()
export class WorkItemResolver {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Notifications of the plant resolved at `at`. Work items still owed then get their current count (O2:
   * "1 stop(s) waiting", not the "2" of alert time); a resolution or a refreshed text makes every bell of the
   * plant refetch.
   */
  resolve(tenantId: string, at: Date = new Date()): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const run = async (statements: readonly string[]) => {
        let count = 0;
        for (const statement of statements) {
          count += updatedCount(await manager.query(statement, [tenantId, at]));
        }
        return count;
      };
      const resolved = await run(RESOLUTION_STATEMENTS);
      const refreshed = await run(REFRESH_STATEMENTS);
      if (resolved + refreshed > 0) {
        await enqueueOutbox(manager, [
          {
            tenantId,
            aggregateType: 'user_notification',
            aggregateId: tenantId,
            type: NOTIFICATIONS_RESOLVED,
            payload: { tenantId, resolved, refreshed },
          },
        ]);
      }
      return resolved;
    });
  }

  /** Plants that have open work-item notifications (the only ones a sweep must look at). */
  async tenantsWithOpenWork(): Promise<string[]> {
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT DISTINCT n."tenant_id"::text AS "id" FROM "user_notifications" n
        WHERE n."resolved_at" IS NULL AND n."work_item_key" IS NOT NULL ORDER BY 1`,
    );
    return rows.map((row) => row.id);
  }
}
