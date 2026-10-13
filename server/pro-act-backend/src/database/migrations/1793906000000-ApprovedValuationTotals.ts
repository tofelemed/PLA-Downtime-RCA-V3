import { MigrationInterface, QueryRunner } from 'typeorm';

const POLICY_EXPRESSION = `app_rls_tenant_ids() IS NULL OR tenant_id IS NULL OR tenant_id::text = ANY (app_rls_tenant_ids())`;

/**
 * VA-01 (EXPERT_REVIEW, 13 Oct 2026): `approved_valuation_totals` — the reconciled plan-ledger valuation of
 * an approved revision per slice, loss kind, view and currency (same columns as `period_valuation_totals`),
 * written in the approval transaction so loss-value reports show the value that was approved. Immutable
 * (`accounting_lines_immutable`), restricted against revision deletion, with the plan 3.11
 * `tenant_isolation` row-level-security policy. Revisions approved before this migration have no rows;
 * reports fall back to their run totals.
 */
export class ApprovedValuationTotals1793906000000
  implements MigrationInterface
{
  name = 'ApprovedValuationTotals1793906000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "approved_valuation_totals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "revision_id" uuid NOT NULL, "period_id" uuid NOT NULL, "slice_id" uuid NOT NULL, "kind" "public"."loss_line_kind" NOT NULL, "view" "public"."valuation_totals_view" NOT NULL, "currency" character varying(3) NOT NULL, "uom" character varying(50), "amount" numeric(28,8), "native_amount" numeric(28,8) NOT NULL, "valued_lines" integer NOT NULL, "unvalued_lines" integer NOT NULL, "fx_missing_lines" integer NOT NULL, "unvalued_quantity" numeric(24,8) NOT NULL, "unvalued_seconds" numeric(24,8) NOT NULL, "status" character varying(16) NOT NULL, "reasons" jsonb NOT NULL DEFAULT '[]', "fx_rate_ids" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "UQ_approved_valuation_totals_cell" UNIQUE ("revision_id", "slice_id", "kind", "view", "currency"), CONSTRAINT "PK_cf55f933e1b9572d6b32346fe7c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ae1d94e7666dd0b53dc1a69d9b" ON "approved_valuation_totals" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_approved_valuation_totals_tenant_period" ON "approved_valuation_totals" ("tenant_id", "period_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "approved_valuation_totals" ADD CONSTRAINT "FK_approved_valuation_totals_revision" FOREIGN KEY ("revision_id") REFERENCES "accounting_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "trg_approved_valuation_totals_immutable" BEFORE UPDATE OR DELETE ON "approved_valuation_totals" ` +
        `FOR EACH ROW EXECUTE FUNCTION "accounting_lines_immutable"()`,
    );
    await queryRunner.query(
      `CREATE POLICY tenant_isolation ON "approved_valuation_totals" USING (${POLICY_EXPRESSION}) WITH CHECK (${POLICY_EXPRESSION})`,
    );
    await queryRunner.query(
      `ALTER TABLE "approved_valuation_totals" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "approved_valuation_totals" FORCE ROW LEVEL SECURITY`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY tenant_isolation ON "approved_valuation_totals"`,
    );
    await queryRunner.query(
      `DROP TRIGGER "trg_approved_valuation_totals_immutable" ON "approved_valuation_totals"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approved_valuation_totals" DROP CONSTRAINT "FK_approved_valuation_totals_revision"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_approved_valuation_totals_tenant_period"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ae1d94e7666dd0b53dc1a69d9b"`,
    );
    await queryRunner.query(`DROP TABLE "approved_valuation_totals"`);
  }
}
