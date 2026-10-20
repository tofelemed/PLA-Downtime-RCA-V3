import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  V1_LEGACY_TABLES,
  V1_LEGACY_TABLES_DDL,
} from '../legacy/v1-legacy-tables.ddl';

/**
 * Contract step after the completed v1 → v2 cutover (owner, 2026-10-20: "check all other v1 tables … if
 * not used drop them all"; D-T2 cutover complete). Drops every table no current code reads or writes:
 * - v1 tables nothing uses: the streaming tables, `query_history`, `historian_tags`, `pi_af_elements`,
 *   `pi_events`, `data_sources`, `production_plan_templates`;
 * - v1 tables only the cutover tool read: `production_losses`, `reconcile_forms`, `loss_categories`,
 *   `oee_summaries`, `rca_trigger_configs`, `unmapped_events` (3 superseded quarantine rows);
 * - the retired cutover tool's own tables (`migration_*`, `legacy_*`; one cutover report row).
 * All other v1-era tables stay because v2 still uses them. `down()` recreates the empty tables.
 */
export class DropV1LegacyTables1794240600000 implements MigrationInterface {
  name = 'DropV1LegacyTables1794240600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of V1_LEGACY_TABLES) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const statement of V1_LEGACY_TABLES_DDL) {
      await queryRunner.query(statement);
    }
  }
}
