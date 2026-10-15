import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const TABLE = 'role_delegations';

const STATEMENTS = [
  `CREATE TABLE "${TABLE}" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
    `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
    `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, ` +
    `"delegator_id" uuid NOT NULL, "delegate_id" uuid NOT NULL, "role" character varying(50) NOT NULL, ` +
    `"scope_kind" character varying(16) NOT NULL, "scope_id" uuid NOT NULL, ` +
    `"valid_from" TIMESTAMP WITH TIME ZONE NOT NULL, "valid_until" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
    `"reason" text NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "revoked_by" uuid, "revoke_reason" text, ` +
    `CONSTRAINT "CHK_role_delegations_interval" CHECK ("valid_until" > "valid_from"), ` +
    `CONSTRAINT "CHK_role_delegations_parties" CHECK ("delegate_id" <> "delegator_id"), ` +
    `CONSTRAINT "CHK_role_delegations_role" CHECK ("role" IN ('manager_approver', 'production_accountant', 'finance_approver', 'quality_approver')), ` +
    `CONSTRAINT "CHK_role_delegations_scope_kind" CHECK ("scope_kind" IN ('tenant', 'site', 'unit')), ` +
    `CONSTRAINT "PK_f57c7d51efadcb32b084a06f806" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_role_delegations_delegate_until" ON "${TABLE}" ("delegate_id", "valid_until")`,
  `CREATE INDEX "IDX_role_delegations_tenant_created" ON "${TABLE}" ("tenant_id", "created_at", "id")`,
  `CREATE INDEX "IDX_role_delegations_delegator" ON "${TABLE}" ("delegator_id")`,
  `ALTER TABLE "${TABLE}" ADD CONSTRAINT "FK_role_delegations_delegator" FOREIGN KEY ("delegator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "${TABLE}" ADD CONSTRAINT "FK_role_delegations_delegate" FOREIGN KEY ("delegate_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `CREATE POLICY tenant_isolation ON "${TABLE}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
  `ALTER TABLE "${TABLE}" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "${TABLE}" FORCE ROW LEVEL SECURITY`,
];

/**
 * SME R1 / R6 delegates: `role_delegations` — a time-boxed hand-over of an approval role (manager approver,
 * production accountant, finance approver, quality approver) from one user to another on a plant, site or
 * unit, with reason and revocation (rows are never deleted). RLS `tenant_isolation`.
 */
export class RoleDelegations1794130005000 implements MigrationInterface {
  name = 'RoleDelegations1794130005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of STATEMENTS) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY tenant_isolation ON "${TABLE}"`);
    await queryRunner.query(`DROP TABLE "${TABLE}"`);
  }
}
