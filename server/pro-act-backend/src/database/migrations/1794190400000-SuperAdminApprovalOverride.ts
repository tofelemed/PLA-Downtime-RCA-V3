import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = [
  'actuals_adjustments',
  'lot_dispositions',
  'uncertainty_budgets',
];

/** Preserve a durable record of privileged self-decisions, even if the actor's role later changes. */
export class SuperAdminApprovalOverride1794190400000
  implements MigrationInterface
{
  name = 'SuperAdminApprovalOverride1794190400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "super_admin_override" boolean NOT NULL DEFAULT false`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "CHK_${table}_independent"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "CHK_${table}_independent" CHECK ("decided_by" IS NULL OR "decided_by" <> "author_id" OR "super_admin_override")`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Refuse a lossy rollback: historical SuperAdmin decisions must not be rewritten or deleted.
    for (const table of TABLES) {
      const rows: unknown = await queryRunner.query(
        `SELECT 1 FROM "${table}" WHERE "decided_by" = "author_id" LIMIT 1`,
      );
      if (Array.isArray(rows) && rows.length) {
        throw new Error(
          'Cannot revert SuperAdmin approval overrides while self-decisions exist',
        );
      }
    }
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "CHK_${table}_independent"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "CHK_${table}_independent" CHECK ("decided_by" IS NULL OR "decided_by" <> "author_id")`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "super_admin_override"`,
      );
    }
  }
}
