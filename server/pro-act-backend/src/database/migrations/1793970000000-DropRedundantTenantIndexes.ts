import { MigrationInterface, QueryRunner } from 'typeorm';

/** Single-column `tenant_id` indexes whose table has a btree index leading with `tenant_id` (name → table). */
const REDUNDANT_TENANT_INDEXES: ReadonlyArray<[string, string]> = [
  ['IDX_81c34e1b45d790b71baf7b6ee5', 'kpi_results'],
  ['IDX_523090df97f616fa678cbcadc8', 'loss_lines'],
  ['IDX_3dc34a6be3139c0194d9cdf107', 'loss_line_evidence'],
  ['IDX_2586003072fff40a76c7e86cf0', 'period_ledger_totals'],
  ['IDX_3d40d7f2c1d6382bdd09b1afa9', 'actuals_results'],
  ['IDX_767a0033709f2c0fddfe5c79b5', 'loss_line_valuations'],
  ['IDX_be45fe5eaafad6c9c468c40ae0', 'period_valuation_totals'],
  ['IDX_ae1d94e7666dd0b53dc1a69d9b', 'approved_valuation_totals'],
  ['IDX_de35ab749d00d26e62e245e956', 'approved_loss_lines'],
  ['IDX_b944406914d03364e7dadaadd5', 'shift_instances'],
  ['IDX_a058ce1c198cb5b09920ba68ce', 'plan_periods'],
];

/**
 * DB-09 (expert review): rewrite-heavy tables — rows written per calculation run, approval or calendar /
 * plan regeneration — carried a single-column `tenant_id` index next to a composite one leading with
 * `tenant_id` (e.g. `IDX_kpi_results_tenant_run_metric`, `IDX_shift_instances_tenant_unit_date`). The
 * composite serves every `tenant_id` predicate (the RLS policy included), so the extra index only cost
 * writes: `pg_stat_user_indexes` on the dev database showed 0 scans for ten of them (18 for
 * `shift_instances` against 65 583 row writes). `IDX_measurement_samples_tenant_signal_observed`
 * duplicated the identity key `(signal_id, observed_at, source_revision)`: every sample read filters a
 * signal (one tenant) and a time range. The entities extend `TenantOwnedEntity` (no tenant index).
 */
export class DropRedundantTenantIndexes1793970000000
  implements MigrationInterface
{
  name = 'DropRedundantTenantIndexes1793970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [index] of REDUNDANT_TENANT_INDEXES) {
      await queryRunner.query(`DROP INDEX "public"."${index}"`);
    }
    await queryRunner.query(
      `DROP INDEX "public"."IDX_measurement_samples_tenant_signal_observed"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_measurement_samples_tenant_signal_observed" ON "measurement_samples" ("tenant_id", "signal_id", "observed_at") `,
    );
    for (const [index, table] of REDUNDANT_TENANT_INDEXES) {
      await queryRunner.query(
        `CREATE INDEX "${index}" ON "${table}" ("tenant_id") `,
      );
    }
  }
}
