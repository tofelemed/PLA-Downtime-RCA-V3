import { MigrationInterface, QueryRunner } from 'typeorm';
import { dropPolicyKind } from '../policy-kind-enum';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const AUDIT_COLUMNS =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL`;

const MONTH_CLOSES =
  `CREATE TABLE "month_closes" (${AUDIT_COLUMNS}, "calendar" character varying(16) NOT NULL, ` +
  `"month_key" character varying(7) NOT NULL, "first_date" date NOT NULL, "end_date" date NOT NULL, ` +
  `"state" character varying(24) NOT NULL DEFAULT 'open', "policy_id" uuid NOT NULL, "policy_version" integer NOT NULL, ` +
  `"quantities_closed_by" uuid, "quantities_closed_at" TIMESTAMP WITH TIME ZONE, "finance_signed_off_by" uuid, ` +
  `"finance_signed_off_at" TIMESTAMP WITH TIME ZONE, "materiality_required" boolean NOT NULL DEFAULT false, ` +
  `"materiality_reviewed_by" uuid, "materiality_reviewed_at" TIMESTAMP WITH TIME ZONE, "locked_by" uuid, ` +
  `"locked_at" TIMESTAMP WITH TIME ZONE, "reopen_count" integer NOT NULL DEFAULT '0', "comment" text, ` +
  `CONSTRAINT "UQ_month_closes_tenant_first_date" UNIQUE ("tenant_id", "first_date"), ` +
  `CONSTRAINT "CHK_month_closes_state" CHECK ("state" IN ('open', 'quantities_closed', 'finance_signed_off', 'locked')), ` +
  `CONSTRAINT "CHK_month_closes_dates" CHECK ("end_date" > "first_date"), ` +
  `CONSTRAINT "PK_c546e0803f7db7ff4d0ec62bd46" PRIMARY KEY ("id"))`;

const MONTH_CLOSE_ACTIONS =
  `CREATE TABLE "month_close_actions" (${AUDIT_COLUMNS}, "month_close_id" uuid NOT NULL, ` +
  `"action" character varying(32) NOT NULL, "from_state" character varying(24) NOT NULL, ` +
  `"to_state" character varying(24) NOT NULL, "actor_id" uuid, "reason" text, "detail" jsonb NOT NULL DEFAULT '{}', ` +
  `CONSTRAINT "PK_8c7142cff543e0d1c58adf15c73" PRIMARY KEY ("id"))`;

const TABLES = ['month_closes', 'month_close_actions'] as const;

/**
 * SME R1 / R4 (EXPERT_REVIEW §3.1, phase R-B): the month close of a plant — `month_closes` (state, both
 * sign-offs, materiality review, lock, the `month_close` policy version it was first acted on under) and
 * its append-only history `month_close_actions` (the 2.8 `workflow_rows_append_only` trigger), both with
 * RLS `tenant_isolation`; `accounting_revisions.after_close` marks a correction opened through a change
 * proposal of a locked month; `accounting_policy_kind` gains `month_close` (seeded per plant on first use).
 * `down` deletes the `month_close` policy versions before restoring the enum.
 */
export class MonthClose1794010000000 implements MigrationInterface {
  name = 'MonthClose1794010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."accounting_policy_kind" ADD VALUE IF NOT EXISTS 'month_close'`,
    );
    await queryRunner.query(MONTH_CLOSES);
    await queryRunner.query(
      `CREATE INDEX "IDX_d58a5489812bd0bb3a3309af3b" ON "month_closes" ("tenant_id")`,
    );
    await queryRunner.query(MONTH_CLOSE_ACTIONS);
    await queryRunner.query(
      `CREATE INDEX "IDX_835a76e43cba29898db7a0bd35" ON "month_close_actions" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_month_close_actions_close" ON "month_close_actions" ("month_close_id", "created_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "month_close_actions" ADD CONSTRAINT "FK_month_close_actions_close" FOREIGN KEY ("month_close_id") ` +
        `REFERENCES "month_closes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "trg_month_close_actions_append_only" BEFORE UPDATE OR DELETE ON "month_close_actions" ` +
        `FOR EACH ROW EXECUTE FUNCTION "workflow_rows_append_only"()`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounting_revisions" ADD "after_close" boolean NOT NULL DEFAULT false`,
    );
    for (const table of TABLES) {
      await queryRunner.query(
        `CREATE POLICY tenant_isolation ON "${table}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
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
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(`DROP POLICY tenant_isolation ON "${table}"`);
    }
    await queryRunner.query(
      `ALTER TABLE "accounting_revisions" DROP COLUMN "after_close"`,
    );
    await queryRunner.query(`DROP TABLE "month_close_actions"`);
    await queryRunner.query(`DROP TABLE "month_closes"`);
    await dropPolicyKind(queryRunner, 'month_close');
  }
}
