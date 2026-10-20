import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Operating report exports (owner 2026-10-20, `plans/REPORTS_R1_R12.md` § Exports): a report of the Reports
 * page as a designed PDF or an Excel workbook through the export worker. `export_report_type` gains
 * `ops_report`, `export_revision_selector` gains `report` (the report's own window and units, no pinned
 * revisions), `export_format` gains `xlsx`, and `export_jobs.report_content` pins the report document as it
 * was read when the export was requested, so re-rendering reproduces the file. A new enum value cannot be
 * used in the transaction that adds it; nothing here uses one. `down` removes the column and the report
 * jobs and leaves the enum values (Postgres cannot drop one; an unused value is harmless), as
 * `ExportRcaCase` does.
 */
export class OpsReportExports1794240900000 implements MigrationInterface {
  name = 'OpsReportExports1794240900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."export_report_type" ADD VALUE IF NOT EXISTS 'ops_report'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."export_revision_selector" ADD VALUE IF NOT EXISTS 'report'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."export_format" ADD VALUE IF NOT EXISTS 'xlsx'`,
    );
    await queryRunner.query(
      `ALTER TABLE "export_jobs" ADD "report_content" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "export_jobs" WHERE "report_type"::text = 'ops_report'`,
    );
    await queryRunner.query(
      `ALTER TABLE "export_jobs" DROP COLUMN "report_content"`,
    );
  }
}
