import { MigrationInterface, QueryRunner } from 'typeorm';
import { dropPolicyKind } from '../policy-kind-enum';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const TABLE = 'period_data_holds';

const CREATE =
  `CREATE TABLE "${TABLE}" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, ` +
  `"period_id" uuid NOT NULL, "unit_id" uuid NOT NULL, "kind" character varying(16) NOT NULL, "reason" text NOT NULL, ` +
  `"started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "started_by" uuid, "ended_at" TIMESTAMP WITH TIME ZONE, ` +
  `"ended_by" uuid, "end_note" text, ` +
  `CONSTRAINT "CHK_period_data_holds_kind" CHECK ("kind" IN ('lab', 'source', 'other')), ` +
  `CONSTRAINT "CHK_period_data_holds_interval" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at"), ` +
  `CONSTRAINT "PK_99b5f79b4108263a735c19952cf" PRIMARY KEY ("id"))`;

const INDEXES: ReadonlyArray<[name: string, definition: string]> = [
  [
    'IDX_7d579a1460bd013cca496c3b8b',
    `INDEX "IDX_7d579a1460bd013cca496c3b8b" ON "${TABLE}" ("tenant_id")`,
  ],
  [
    'UQ_period_data_holds_open',
    `UNIQUE INDEX "UQ_period_data_holds_open" ON "${TABLE}" ("period_id") WHERE "ended_at" IS NULL`,
  ],
  [
    'IDX_period_data_holds_tenant_period',
    `INDEX "IDX_period_data_holds_tenant_period" ON "${TABLE}" ("tenant_id", "period_id")`,
  ],
];

/**
 * SME R3 / R6 (EXPERT_REVIEW §3.1, phase R-C): "waiting for data" holds of a period (`period_data_holds`,
 * RLS `tenant_isolation`, at most one open hold per period), `approval_actions.detail` for what a
 * rejection names (failed lines, the new due time, the rejection count) and the policy kind
 * `reconciliation_sla` (seeded per plant on first use). `down` deletes the kind's versions first.
 */
export class ReconciliationSla1794010100000 implements MigrationInterface {
  name = 'ReconciliationSla1794010100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."accounting_policy_kind" ADD VALUE IF NOT EXISTS 'reconciliation_sla'`,
    );
    await queryRunner.query(CREATE);
    for (const [, definition] of INDEXES) {
      await queryRunner.query(`CREATE ${definition}`);
    }
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "FK_period_data_holds_period" FOREIGN KEY ("period_id") ` +
        `REFERENCES "production_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_actions" ADD "detail" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `CREATE POLICY tenant_isolation ON "${TABLE}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
    );
    await queryRunner.query(`ALTER TABLE "${TABLE}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "${TABLE}" FORCE ROW LEVEL SECURITY`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY tenant_isolation ON "${TABLE}"`);
    await queryRunner.query(
      `ALTER TABLE "approval_actions" DROP COLUMN "detail"`,
    );
    await queryRunner.query(`DROP TABLE "${TABLE}"`);
    await dropPolicyKind(queryRunner, 'reconciliation_sla');
  }
}
