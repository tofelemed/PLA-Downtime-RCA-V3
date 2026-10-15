import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE = 'accounting_policies';
const CHECK = 'CHK_accounting_policies_decision';
const PENDING = 'IDX_accounting_policies_pending';

/**
 * Owner, 15 Oct 2026: source authority versions are maker-checker master data. A version is written as a
 * draft (`approved_at` null, outside resolution) and comes into force only when production accounting
 * approves it, never its author; a rejection records who, when and why. `based_on_id` is the version in
 * force the draft was prepared from, so an approval refuses a draft whose base has since been replaced.
 * Existing rows keep their approval stamps; nothing is backfilled.
 */
export class SourceAuthorityMakerChecker1794180030000
  implements MigrationInterface
{
  name = 'SourceAuthorityMakerChecker1794180030000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD "rejected_by" uuid, ADD "rejected_at" TIMESTAMP WITH TIME ZONE, ` +
        `ADD "rejection_reason" text, ADD "based_on_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${CHECK}" CHECK ("approved_at" IS NULL OR "rejected_at" IS NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "${PENDING}" ON "${TABLE}" ("tenant_id", "policy_kind", "created_at") ` +
        `WHERE "approved_at" IS NULL AND "rejected_at" IS NULL`,
    );
  }

  /** Drafts and rejected source authority versions were never in force; the old resolver would apply them. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "${TABLE}" WHERE "policy_kind" = 'source_authority' AND "approved_at" IS NULL`,
    );
    await queryRunner.query(`DROP INDEX "public"."${PENDING}"`);
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "${CHECK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP COLUMN "based_on_id", DROP COLUMN "rejection_reason", ` +
        `DROP COLUMN "rejected_at", DROP COLUMN "rejected_by"`,
    );
  }
}
