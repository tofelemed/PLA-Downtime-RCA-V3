import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Item 2.5: a PDF report of one RCA case through the export worker. `export_report_type` gains `rca_case`,
 * `export_revision_selector` gains `case` (one case, no revisions), and `export_jobs.case_content` pins the
 * case as it was read when the export was requested (definition, team, timeline, causes, analyses, actions,
 * outcome, closure), so re-rendering the job reproduces its bytes. A new enum value cannot be used in the
 * transaction that adds it; nothing here uses one. `down` removes the column and the case jobs (their
 * content is gone with it) and leaves the enum values in place, as `ReversalLineKind` does: Postgres cannot
 * drop an enum value, an unused value is harmless, and reverting `ExportsAndDomainEvents` drops the types.
 */
export class ExportRcaCase1794240100000 implements MigrationInterface {
  name = 'ExportRcaCase1794240100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."export_report_type" ADD VALUE IF NOT EXISTS 'rca_case'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."export_revision_selector" ADD VALUE IF NOT EXISTS 'case'`,
    );
    await queryRunner.query(
      `ALTER TABLE "export_jobs" ADD "case_content" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "export_jobs" WHERE "report_type"::text = 'rca_case'`,
    );
    await queryRunner.query(
      `ALTER TABLE "export_jobs" DROP COLUMN "case_content"`,
    );
  }
}
