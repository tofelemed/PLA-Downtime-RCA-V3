import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE = 'user_notifications';
const CHECK = 'CHK_user_notifications_kind';

/**
 * Plan 1.10 step 5 (SRC01 fallback banner): `user_notifications.kind` also takes `source_fallback` —
 * production accounting and integration of a unit are told when its actuals move to a substitute source or
 * back to the top-ranked one. `down` deletes those notifications and restores the previous check.
 */
export class SourceFallbackNotifications1794190300000
  implements MigrationInterface
{
  name = 'SourceFallbackNotifications1794190300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "${CHECK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${CHECK}" CHECK ("kind" IN ('sla_reminder', 'sla_escalation', 'source_fallback'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "${TABLE}" WHERE "kind" = 'source_fallback'`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "${CHECK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${CHECK}" CHECK ("kind" IN ('sla_reminder', 'sla_escalation'))`,
    );
  }
}
