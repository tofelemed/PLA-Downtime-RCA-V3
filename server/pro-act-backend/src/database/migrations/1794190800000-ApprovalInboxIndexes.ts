import { MigrationInterface, QueryRunner } from 'typeorm';

const PENDING_INDEXES: Array<[string, string]> = [
  ['production_profiles', "state = 'draft'"],
  ['unit_product_rates', "state = 'draft'"],
  ['valuation_rates', "state = 'draft'"],
  ['transition_standards', "state = 'draft'"],
  ['unit_streams', "state = 'draft'"],
  ['plant_flow_routes', "state = 'draft'"],
  ['unit_impact_rules', "state = 'draft'"],
  ['fx_rates', "state = 'draft'"],
  ['demand_statuses', "state = 'draft'"],
  ['plan_versions', "approval_state = 'submitted'"],
  [
    'accounting_policies',
    "approved_at IS NULL AND policy_kind IN ('valuation_basis','source_authority')",
  ],
  ['source_status_mappings', "state = 'draft'"],
  ['actuals_adjustments', "state = 'proposed'"],
  ['lot_dispositions', "state = 'proposed'"],
  ['uncertainty_budgets', "state = 'proposed'"],
  ['rules', 'draft_definition IS NOT NULL AND retired_at IS NULL'],
  [
    'accounting_revisions',
    "lifecycle = 'in_review' AND submitted_at IS NOT NULL",
  ],
  ['period_change_proposals', "state = 'open'"],
  ['rcas', "status = 'closure_review'"],
  ['month_closes', "state IN ('quantities_closed','finance_signed_off')"],
  ['stop_reconciliations', "state = 'suggested'"],
];

export class ApprovalInboxIndexes1794190800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_approval_inbox_postings" ON accounting_revisions (tenant_id, created_at, id) WHERE lifecycle = 'approved' AND supersedes_id IS NOT NULL`,
    );
    for (const [table, predicate] of PENDING_INDEXES) {
      await queryRunner.query(
        `CREATE INDEX "IDX_approval_inbox_${table}" ON "${table}" (tenant_id, created_at, id) WHERE ${predicate}`,
      );
    }
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_approval_inbox_postings"');
    for (const [table] of [...PENDING_INDEXES].reverse()) {
      await queryRunner.query(`DROP INDEX "IDX_approval_inbox_${table}"`);
    }
  }
}
