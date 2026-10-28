import { MigrationInterface, QueryRunner } from 'typeorm';

/** Foreign keys that had no covering index (deploy/analysis/fk-without-index.txt): table, column. */
const FK_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['approved_loss_lines', 'revision_id'],
  ['event_coding', 'reason_code_version_id'],
  ['event_coding', 'oee_code_version_id'],
  ['event_coding', 'impact_code_version_id'],
  ['event_impacts', 'rule_id'],
  ['event_relations', 'to_event_id'],
  ['failure_code_groups', 'parent_id'],
  ['loss_category_defs', 'parent_id'],
  ['period_change_proposals', 'period_id'],
  ['plant_flow_routes', 'to_unit_id'],
  ['production_events', 'reason_code_id'],
  ['production_events', 'asset_id'],
  ['production_plans', 'tenant_id'],
  ['rca_actions', 'rca_id'],
  ['rca_causes', 'cause_code_id'],
  ['rca_causes', 'rca_id'],
  ['rca_knowledge_base', 'rca_id'],
  ['rca_trigger_evaluations', 'rca_id'],
  ['rcas', 'template_id'],
  ['rcas', 'event_id'],
  ['rcas', 'team_lead_id'],
  ['reason_codes', 'default_impact_code_id'],
  ['reason_codes', 'parent_id'],
  ['reconciliation_line_sets', 'period_id'],
  ['replay_runs', 'connection_id'],
  ['restatement_postings', 'period_id'],
  ['rule_runs', 'rule_id'],
  ['shift_notes', 'unit_id'],
  ['signal_backfill_runs', 'signal_id'],
  ['signals', 'connection_id'],
  ['signals', 'unit_id'],
  ['stop_reconciliations', 'kept_event_id'],
  ['stop_reconciliations', 'evidence_event_id'],
  ['unit_impact_rules', 'asset_id'],
];

/**
 * Indexes every foreign-key column that lacked one, so joins and cascading deletes on the parent
 * do not scan the child table. Table names stay unqualified so the SQL exports to any schema.
 */
export class FkIndexes1794242000000 implements MigrationInterface {
  name = 'FkIndexes1794242000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of FK_COLUMNS) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_${table}_${column}" ON "${table}" ("${column}")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of FK_COLUMNS) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_${table}_${column}"`);
    }
  }
}
