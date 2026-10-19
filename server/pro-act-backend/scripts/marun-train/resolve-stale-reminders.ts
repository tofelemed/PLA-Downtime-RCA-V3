/**
 * Stale work reminders (QA re-test decision 2026-10-19): resolves, in every plant, the open role-addressed
 * reminders (uncoded stops, long open stops, SLA checker reminders and escalations) of recipients who no longer
 * hold the role — e.g. the 18 Oct "Uncoded stops waiting" reminders of Sara, Neda, Arman, Darya, Kamran, Mina,
 * Bahram and Farid after `apply-guide-roles.ts` removed their production engineer mirror. The released backend
 * does the same in its minute sweep (`WorkItemResolver`, `role-lost-resolution-sql.ts`); this one-off applies it
 * now. Only `user_notifications.resolved_at / resolution` change (`superseded`); the rows stay readable as
 * history. Idempotent.
 *
 *   npx ts-node scripts/marun-train/resolve-stale-reminders.ts [-- --dry-run]
 *
 * Env: the database of `.env` (DB_HOST, DB_PORT, DB_NAME, …).
 */
import { AppDataSource } from '../../src/database/data-source';
import { parseCliArgs } from '../../src/migration-cutover/cli/cli-args';
import {
  ROLE_LOST,
  ROLE_LOST_SELECT,
} from '../../src/notifications/role-lost-resolution-sql';

interface StaleRow {
  id: string;
  user_id: string;
}

async function plantsWithOpenWork(): Promise<string[]> {
  const rows: Array<{ id: string }> = await AppDataSource.query(
    `SELECT DISTINCT tenant_id::text AS id FROM user_notifications
      WHERE resolved_at IS NULL AND work_item_key IS NOT NULL ORDER BY 1`,
  );
  return rows.map((row) => row.id);
}

async function main(): Promise<void> {
  const dryRun = parseCliArgs(process.argv.slice(2)).flags['dry-run'] === true;
  await AppDataSource.initialize();
  const at = new Date();
  let total = 0;
  try {
    for (const tenantId of await plantsWithOpenWork()) {
      const stale: StaleRow[] = await AppDataSource.query(ROLE_LOST_SELECT, [
        tenantId,
        at,
      ]);
      if (stale.length === 0) continue;
      const users = new Set(stale.map((row) => row.user_id)).size;
      if (!dryRun) await AppDataSource.query(ROLE_LOST, [tenantId, at]);
      total += stale.length;
      process.stdout.write(
        `${tenantId}: ${stale.length} reminder(s) of ${users} user(s) ${dryRun ? 'would be resolved' : 'resolved'}\n`,
      );
    }
    process.stdout.write(
      `${dryRun ? 'Dry run: ' : ''}${total} stale reminder(s) in total\n`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
