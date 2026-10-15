import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PDF report exports (owner 15 Oct): `export_format` gains `pdf` (type recreated, so it is usable in the
 * same transaction), and `export_jobs.presentation` pins the plant display settings and the display
 * currency a PDF is rendered with, so re-rendering a job reproduces its bytes. CSV jobs keep it null.
 */
const UP: readonly string[] = [
  `ALTER TYPE "public"."export_format" RENAME TO "export_format_old"`,
  `CREATE TYPE "public"."export_format" AS ENUM('csv', 'pdf')`,
  `ALTER TABLE "export_jobs" ALTER COLUMN "format" TYPE "public"."export_format" USING "format"::"text"::"public"."export_format"`,
  `DROP TYPE "public"."export_format_old"`,
  `ALTER TABLE "export_jobs" ADD "presentation" jsonb`,
];

/** Reverting removes PDF jobs (a CSV-only schema cannot hold them); their files expire with the store. */
const DOWN: readonly string[] = [
  `ALTER TABLE "export_job_sources" DISABLE TRIGGER "trg_export_job_sources_append_only"`,
  `ALTER TABLE "export_jobs" DISABLE TRIGGER "trg_export_jobs_completed_immutable"`,
  `DELETE FROM "export_job_sources" WHERE "export_job_id" IN (SELECT "id" FROM "export_jobs" WHERE "format" = 'pdf')`,
  `DELETE FROM "export_jobs" WHERE "format" = 'pdf'`,
  `ALTER TABLE "export_jobs" ENABLE TRIGGER "trg_export_jobs_completed_immutable"`,
  `ALTER TABLE "export_job_sources" ENABLE TRIGGER "trg_export_job_sources_append_only"`,
  `ALTER TABLE "export_jobs" DROP COLUMN "presentation"`,
  `CREATE TYPE "public"."export_format_old" AS ENUM('csv')`,
  `ALTER TABLE "export_jobs" ALTER COLUMN "format" TYPE "public"."export_format_old" USING "format"::"text"::"public"."export_format_old"`,
  `DROP TYPE "public"."export_format"`,
  `ALTER TYPE "public"."export_format_old" RENAME TO "export_format"`,
];

export class ExportPdfFormat1794150000000 implements MigrationInterface {
  name = 'ExportPdfFormat1794150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
