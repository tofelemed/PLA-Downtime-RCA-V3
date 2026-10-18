import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE = 'user_notifications';

/**
 * Shared work-item notifications (owner 18 Oct): every recipient's copy of one piece of work carries the same
 * `work_item_key` and is resolved for everyone once anyone does the work (`resolved_at`, `resolution`
 * completed / superseded). Existing rows get their key from the dedupe key with the same rules as
 * `workItemKeyOf` (level and recipient dropped; source fallbacks stay null). Indexes: the active list per
 * user (keyset), the active unread count (replaces the unread index) and the open work items per plant the
 * resolver reads. `down` drops the columns and restores the previous unread index.
 */
export class NotificationWorkItemResolution1794222350000
  implements MigrationInterface
{
  name = 'NotificationWorkItemResolution1794222350000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD "work_item_key" character varying(200), ADD "resolved_at" TIMESTAMP WITH TIME ZONE, ` +
        `ADD "resolution" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "CHK_user_notifications_resolution" CHECK (` +
        `("resolved_at" IS NULL AND "resolution" IS NULL) OR ("resolved_at" IS NOT NULL AND "resolution" IN ('completed', 'superseded')))`,
    );
    await queryRunner.query(
      `UPDATE "${TABLE}" SET "work_item_key" = CASE
         WHEN "kind" IN ('uncoded_backlog', 'long_open_stop') THEN regexp_replace("dedupe_key", ':[0-9]+$', '')
         WHEN "kind" IN ('rca_action_due', 'rca_action_overdue', 'task_due', 'task_overdue')
           THEN regexp_replace("dedupe_key", '^(rca-action|task):([^:]+):(due|overdue):(.+?Z)(:[0-9]+)?$', '\\1:\\2:\\4')
         WHEN "kind" = 'sla_escalation' THEN regexp_replace("dedupe_key", '^(sla:[^:]+):age:[0-9]+$', '\\1:approval')
         WHEN "kind" = 'sla_reminder' THEN "dedupe_key"
         ELSE NULL END`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_notifications_user_unread"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_notifications_user_unread" ON "${TABLE}" ("tenant_id", "user_id") ` +
        `WHERE "read_at" IS NULL AND "resolved_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_notifications_user_active" ON "${TABLE}" ("tenant_id", "user_id", "created_at", "id") ` +
        `WHERE "resolved_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_notifications_open_work" ON "${TABLE}" ("tenant_id", "kind") ` +
        `WHERE "resolved_at" IS NULL AND "work_item_key" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_notifications_open_work"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_notifications_user_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_notifications_user_unread"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_notifications_user_unread" ON "${TABLE}" ("tenant_id", "user_id") WHERE "read_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "CHK_user_notifications_resolution"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP COLUMN "resolution", DROP COLUMN "resolved_at", DROP COLUMN "work_item_key"`,
    );
  }
}
