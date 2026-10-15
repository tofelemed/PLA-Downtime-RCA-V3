import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const TABLE = 'production_day_certifications';

const STATEMENTS = [
  `CREATE TABLE "${TABLE}" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
    `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
    `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, ` +
    `"unit_id" uuid NOT NULL, "local_date" date NOT NULL, "state" character varying(16) NOT NULL DEFAULT 'certified', ` +
    `"revisions" jsonb NOT NULL, "rollup_hash" character varying(64) NOT NULL, "certified_by" uuid NOT NULL, ` +
    `"certified_at" TIMESTAMP WITH TIME ZONE NOT NULL, "comment" text, "reopened_by" uuid, ` +
    `"reopened_at" TIMESTAMP WITH TIME ZONE, "reopen_reason" text, ` +
    `CONSTRAINT "CHK_production_day_certifications_state" CHECK ("state" IN ('certified', 'reopened')), ` +
    `CONSTRAINT "PK_c933a977da283e40aa1b96c3d0c" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_1e09340b68d8478a6133ebb4d9" ON "${TABLE}" ("tenant_id")`,
  `CREATE INDEX "IDX_production_day_certifications_tenant_date" ON "${TABLE}" ("tenant_id", "local_date")`,
  `CREATE INDEX "IDX_production_day_certifications_unit_date" ON "${TABLE}" ("unit_id", "local_date")`,
  `CREATE UNIQUE INDEX "UQ_production_day_certifications_certified" ON "${TABLE}" ("unit_id", "local_date") WHERE "state" = 'certified'`,
  `ALTER TABLE "${TABLE}" ADD CONSTRAINT "FK_production_day_certifications_unit" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `CREATE POLICY tenant_isolation ON "${TABLE}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
  `ALTER TABLE "${TABLE}" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "${TABLE}" FORCE ROW LEVEL SECURITY`,
];

/**
 * Owner decision 14 Oct 2026 / SME R2 (EXPERT_REVIEW §3.1, phase R-E): one approval per production day of a
 * unit certifies the roll-up of its approved shift periods (`production_day_certifications`, at most one
 * certified row per unit and date, RLS `tenant_isolation`); a revise of a certified shift reopens it.
 */
export class DayCertification1794010300000 implements MigrationInterface {
  name = 'DayCertification1794010300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of STATEMENTS) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY tenant_isolation ON "${TABLE}"`);
    await queryRunner.query(`DROP TABLE "${TABLE}"`);
  }
}
