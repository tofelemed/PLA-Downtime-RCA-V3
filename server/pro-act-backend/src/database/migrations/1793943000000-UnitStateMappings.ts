import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const TABLE = 'unit_state_mappings';
const METRICS = [
  'state_coverage',
  'availability_lower_bound',
  'availability_upper_bound',
];

/**
 * SME D1 / D2 (EXPERT_REVIEW §2.1): per unit, the state signal's value → physical state mapping and its
 * heartbeat (stale after N expected intervals + jitter; exception-based sources never go stale), versioned.
 * `kpi_metric` gains the known-data coverage and the availability lower / upper bounds published instead
 * of a certified availability over unknown time. RLS `tenant_isolation` (DB-04 form). `down` leaves the
 * enum values in place (Postgres cannot drop an enum value while views read the column).
 */
export class UnitStateMappings1793943000000 implements MigrationInterface {
  name = 'UnitStateMappings1793943000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "${TABLE}" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "unit_id" uuid NOT NULL, "signal_id" uuid NOT NULL, "rules" jsonb NOT NULL, "expected_interval_seconds" integer NOT NULL, "jitter_seconds" integer NOT NULL DEFAULT '0', "stale_after_intervals" integer NOT NULL DEFAULT '3', "is_heartbeat" boolean NOT NULL DEFAULT true, "version" integer NOT NULL DEFAULT '1', "notes" text, "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_unit_state_mappings_heartbeat" CHECK ("expected_interval_seconds" > 0 AND "jitter_seconds" >= 0 AND "stale_after_intervals" >= 1), CONSTRAINT "CHK_unit_state_mappings_interval" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), CONSTRAINT "PK_76274cb1f9c2cd7df6f2fab0638" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8c8c3702fc08ec58a536e91021" ON "${TABLE}" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_unit_state_mappings_tenant_unit_from" ON "${TABLE}" ("tenant_id", "unit_id", "effective_from") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_unit_state_mappings_current" ON "${TABLE}" ("tenant_id", "unit_id") WHERE "effective_to" IS NULL`,
    );
    await queryRunner.query(
      `CREATE POLICY tenant_isolation ON "${TABLE}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
    );
    await queryRunner.query(`ALTER TABLE "${TABLE}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "${TABLE}" FORCE ROW LEVEL SECURITY`);
    for (const metric of METRICS) {
      await queryRunner.query(
        `ALTER TYPE "public"."kpi_metric" ADD VALUE IF NOT EXISTS '${metric}'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY tenant_isolation ON "${TABLE}"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_unit_state_mappings_current"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_unit_state_mappings_tenant_unit_from"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8c8c3702fc08ec58a536e91021"`,
    );
    await queryRunner.query(`DROP TABLE "${TABLE}"`);
  }
}
