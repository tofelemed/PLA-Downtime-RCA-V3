import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SME R3 due reminders: `user_notifications.kind` also takes `sla_reminder` (the preparer / checker is told
 * when a stage falls due, before any escalation). `down` deletes the reminders and restores the old check.
 */
export class SlaReminders1794130000000 implements MigrationInterface {
  name = 'SlaReminders1794130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_notifications" DROP CONSTRAINT "CHK_user_notifications_kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_notifications" ADD CONSTRAINT "CHK_user_notifications_kind" CHECK ("kind" IN ('sla_reminder', 'sla_escalation'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "user_notifications" WHERE "kind" = 'sla_reminder'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_notifications" DROP CONSTRAINT "CHK_user_notifications_kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_notifications" ADD CONSTRAINT "CHK_user_notifications_kind" CHECK ("kind" IN ('sla_escalation'))`,
    );
  }
}
