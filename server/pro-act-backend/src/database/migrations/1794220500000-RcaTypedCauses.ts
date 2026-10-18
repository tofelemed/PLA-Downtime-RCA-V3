import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const CAUSES =
  `CREATE TABLE "rca_causes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, ` +
  `"rca_id" uuid NOT NULL, "kind" character varying(16) NOT NULL, "cause_code_id" uuid, "statement" text NOT NULL, ` +
  `"evidence_ids" jsonb NOT NULL DEFAULT '[]', "node_ids" jsonb NOT NULL DEFAULT '[]', ` +
  `CONSTRAINT "CHK_rca_causes_kind" CHECK ("kind" IN ('direct', 'contributing', 'root')), ` +
  `CONSTRAINT "PK_f742927e2198a8ab2da2cb2de1a" PRIMARY KEY ("id"))`;

/**
 * Typed causes of an RCA case (item 7): `rca_causes` — direct / contributing / root, optionally linked to
 * the cause catalogue (RESTRICT: a used cause code is retired, never deleted), with the evidence items and
 * logic-tree nodes that support it; gone with its case (CASCADE, like actions and links). Indexed by case
 * and by cause code (recurring-cause report). `rcas.coded_root_cause_required`: existing cases keep the
 * free-text root-cause rule (false); every case inserted afterwards — by any path — gets true from the
 * column default and needs a coded root cause to request closure.
 */
export class RcaTypedCauses1794220500000 implements MigrationInterface {
  name = 'RcaTypedCauses1794220500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(CAUSES);
    await queryRunner.query(
      `CREATE INDEX "IDX_rca_causes_tenant_rca" ON "rca_causes" ("tenant_id", "rca_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rca_causes_tenant_code" ON "rca_causes" ("tenant_id", "cause_code_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_causes" ADD CONSTRAINT "FK_rca_causes_rca" FOREIGN KEY ("rca_id") REFERENCES "rcas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_causes" ADD CONSTRAINT "FK_rca_causes_cause_code" FOREIGN KEY ("cause_code_id") REFERENCES "rca_cause_codes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE POLICY tenant_isolation ON "rca_causes" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_causes" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_causes" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "rcas" ADD "coded_root_cause_required" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "rcas" ALTER COLUMN "coded_root_cause_required" SET DEFAULT true`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rcas" DROP COLUMN "coded_root_cause_required"`,
    );
    await queryRunner.query(`DROP POLICY tenant_isolation ON "rca_causes"`);
    await queryRunner.query(
      `ALTER TABLE "rca_causes" DROP CONSTRAINT "FK_rca_causes_cause_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_causes" DROP CONSTRAINT "FK_rca_causes_rca"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_rca_causes_tenant_code"`);
    await queryRunner.query(`DROP INDEX "IDX_rca_causes_tenant_rca"`);
    await queryRunner.query(`DROP TABLE "rca_causes"`);
  }
}
