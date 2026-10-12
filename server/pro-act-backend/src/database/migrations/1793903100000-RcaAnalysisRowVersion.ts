import { MigrationInterface, QueryRunner } from 'typeorm';

/** RCA analysis records edited through v2 (five-why … change): row version for ETag / If-Match. */
const TABLES = [
  'rca_five_why_analyses',
  'rca_fishbone_diagrams',
  'rca_fmea_analyses',
  'rca_fault_tree_analyses',
  'rca_barrier_analyses',
  'rca_change_analyses',
];

export class RcaAnalysisRowVersion1793903100000 implements MigrationInterface {
  name = 'RcaAnalysisRowVersion1793903100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "row_version" integer NOT NULL DEFAULT 1`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "row_version"`,
      );
    }
  }
}
