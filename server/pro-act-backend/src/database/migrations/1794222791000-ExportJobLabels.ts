import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * QA audit 2026-10-19 (exports): `export_jobs.labels` pins the requester's name, the plant clock and the
 * names of the reason codes a loss-line export refers to when the job is requested, so the CSV / PDF can
 * print readable reasons, names and plant-time columns while re-rendering still reproduces the bytes.
 * Additive and nullable: jobs requested earlier keep null and print those cells empty.
 */
export class ExportJobLabels1794222791000 implements MigrationInterface {
  name = 'ExportJobLabels1794222791000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "export_jobs" ADD "labels" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "export_jobs" DROP COLUMN "labels"`);
  }
}
