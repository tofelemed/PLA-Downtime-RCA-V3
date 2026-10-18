import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE = 'user_notifications';
const CHECK = 'CHK_user_notifications_kind';
const PREVIOUS_KINDS = `'sla_reminder', 'sla_escalation', 'source_fallback'`;
const NEW_KINDS = `'rca_action_due', 'rca_action_overdue', 'task_due', 'task_overdue', 'uncoded_backlog', 'long_open_stop'`;

/**
 * Item 6 (work and downtime reminders): `user_notifications.kind` also takes the due / overdue reminders of
 * RCA corrective actions and tasks, the uncoded stop backlog of a unit and day and long open stops. Indexes:
 * open events oldest first (`IDX_production_events_open_start`, shared with the RCA open-event sweep, which
 * reads every tenant) and closed uncoded stops by end time (`IDX_production_events_uncoded_stops`). Actions
 * and tasks by due date already have `IDX_rca_actions_tenant_due` / `IDX_tasks_tenant_due`. `down` deletes
 * the new notifications, drops the indexes and restores the previous check.
 */
export class WorkReminderNotifications1794220300000
  implements MigrationInterface
{
  name = 'WorkReminderNotifications1794220300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "${CHECK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${CHECK}" CHECK ("kind" IN (${PREVIOUS_KINDS}, ${NEW_KINDS}))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_open_start" ON "production_events" ("start_time", "id") ` +
        `WHERE "end_time" IS NULL AND "physical_state" = 'open'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_uncoded_stops" ON "production_events" ("tenant_id", "end_time") ` +
        `WHERE "physical_type" = 'downtime' AND "coding_state" = 'uncoded' AND "physical_state" = 'closed'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_production_events_uncoded_stops"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_production_events_open_start"`,
    );
    await queryRunner.query(
      `DELETE FROM "${TABLE}" WHERE "kind" IN (${NEW_KINDS})`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "${CHECK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${CHECK}" CHECK ("kind" IN (${PREVIOUS_KINDS}))`,
    );
  }
}
