import { MigrationInterface, QueryRunner } from 'typeorm';

const POLICY = `(SELECT app_rls_tenant_ids()) IS NULL OR tenant_id IS NULL OR tenant_id::text = ANY ((SELECT app_rls_tenant_ids())::text[])`;
const TABLES = ['approved_loss_lines', 'approved_loss_line_valuations'];

/**
 * VA-01b (EXPERT_REVIEW, 13 Oct 2026): the approved plan ledger line by line — `approved_loss_lines`
 * (decided candidates and own-quantity lines with codes, cause and quantity) and their valuation per view
 * and currency — written at approval so the loss tree and the RCA approved impact show approved figures.
 * Immutable (`accounting_lines_immutable`), RLS `tenant_isolation` (DB-04 form).
 */
export class ApprovedLedgerLines1793914000000 implements MigrationInterface {
  name = 'ApprovedLedgerLines1793914000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "approved_loss_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "revision_id" uuid NOT NULL, "period_id" uuid NOT NULL, "slice_id" uuid NOT NULL, "source" character varying(16) NOT NULL, "source_id" uuid NOT NULL, "cause_event_id" uuid, "kind" "public"."loss_line_kind" NOT NULL, "oee_component" character varying(16), "reason_code_id" uuid, "impact_code_id" uuid, "uom" character varying(50), "quantity" numeric(24,8) NOT NULL, CONSTRAINT "PK_224640870b4d07807ccf518276f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_de35ab749d00d26e62e245e956" ON "approved_loss_lines" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_approved_loss_lines_tenant_cause" ON "approved_loss_lines" ("tenant_id", "cause_event_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_approved_loss_lines_tenant_revision" ON "approved_loss_lines" ("tenant_id", "revision_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "approved_loss_line_valuations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "approved_line_id" uuid NOT NULL, "view" "public"."valuation_view" NOT NULL, "currency" character varying(3) NOT NULL, "amount" numeric(28,8), "status" character varying(16) NOT NULL, "reason" character varying(64), CONSTRAINT "UQ_approved_loss_line_valuations_cell" UNIQUE ("approved_line_id", "view", "currency"), CONSTRAINT "PK_6064c69c2f87a872a2d2bf2ab0f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5dca9ea5566957e12f31d4d086" ON "approved_loss_line_valuations" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_approved_loss_line_valuations_line" ON "approved_loss_line_valuations" ("approved_line_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "approved_loss_lines" ADD CONSTRAINT "FK_approved_loss_lines_revision" FOREIGN KEY ("revision_id") REFERENCES "accounting_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "approved_loss_line_valuations" ADD CONSTRAINT "FK_approved_loss_line_valuations_line" FOREIGN KEY ("approved_line_id") REFERENCES "approved_loss_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    for (const table of TABLES) {
      await queryRunner.query(
        `CREATE TRIGGER "trg_${table}_immutable" BEFORE UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION "accounting_lines_immutable"()`,
      );
      await queryRunner.query(
        `CREATE POLICY tenant_isolation ON "${table}" USING (${POLICY}) WITH CHECK (${POLICY})`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(`DROP POLICY tenant_isolation ON "${table}"`);
      await queryRunner.query(
        `DROP TRIGGER "trg_${table}_immutable" ON "${table}"`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "approved_loss_line_valuations" DROP CONSTRAINT "FK_approved_loss_line_valuations_line"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approved_loss_lines" DROP CONSTRAINT "FK_approved_loss_lines_revision"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_approved_loss_line_valuations_line"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5dca9ea5566957e12f31d4d086"`,
    );
    await queryRunner.query(`DROP TABLE "approved_loss_line_valuations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_approved_loss_lines_tenant_revision"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_approved_loss_lines_tenant_cause"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_de35ab749d00d26e62e245e956"`,
    );
    await queryRunner.query(`DROP TABLE "approved_loss_lines"`);
  }
}
