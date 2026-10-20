import { MigrationInterface, QueryRunner } from 'typeorm';
import { V1_RCA_TABLES, V1_RCA_TABLES_DDL } from '../legacy/v1-rca-tables.ddl';

/**
 * Contract step of the v1 → v2 RCA cutover (owner, 2026-10-20: "drop v1"): the ten v1 RCA analysis tables
 * that nothing reads or writes any more (v2 keeps its analyses in `rca_analysis_*` and the case JSON) —
 * fishbone, 5-Why, fault tree, FMEA, barrier, change, logic-tree nodes, analysis configs, evidence and
 * recommendations. They were empty on the plant database. `evidence_categories` / `evidence_locations` stay
 * (v2 evidence options read them). `down()` recreates the empty tables exactly as they were.
 */
export class DropV1RcaTables1794240500000 implements MigrationInterface {
  name = 'DropV1RcaTables1794240500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of V1_RCA_TABLES) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const statement of V1_RCA_TABLES_DDL) {
      await queryRunner.query(statement);
    }
  }
}
