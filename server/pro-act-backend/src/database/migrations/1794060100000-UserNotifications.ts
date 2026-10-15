import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const TABLE = 'user_notifications';

const STATEMENTS = [
  `CREATE TABLE "${TABLE}" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
    `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
    `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, ` +
    `"user_id" uuid NOT NULL, "kind" character varying(32) NOT NULL, "dedupe_key" character varying(200) NOT NULL, ` +
    `"entity_type" character varying(64) NOT NULL, "entity_id" uuid NOT NULL, "detail" jsonb NOT NULL DEFAULT '{}', ` +
    `"read_at" TIMESTAMP WITH TIME ZONE, ` +
    `CONSTRAINT "CHK_user_notifications_kind" CHECK ("kind" IN ('sla_escalation')), ` +
    `CONSTRAINT "PK_569622b0fd6e6ab3661de985a2b" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_14c3aac4fa45210bfd61640e67" ON "${TABLE}" ("tenant_id")`,
  `CREATE UNIQUE INDEX "UQ_user_notifications_user_key" ON "${TABLE}" ("tenant_id", "user_id", "dedupe_key")`,
  `CREATE INDEX "IDX_user_notifications_user_created" ON "${TABLE}" ("tenant_id", "user_id", "created_at", "id")`,
  `CREATE INDEX "IDX_user_notifications_user_unread" ON "${TABLE}" ("tenant_id", "user_id") WHERE "read_at" IS NULL`,
  `CREATE INDEX "IDX_user_notifications_user" ON "${TABLE}" ("user_id")`,
  `ALTER TABLE "${TABLE}" ADD CONSTRAINT "FK_user_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `CREATE POLICY tenant_isolation ON "${TABLE}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
  `ALTER TABLE "${TABLE}" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "${TABLE}" FORCE ROW LEVEL SECURITY`,
];

/**
 * In-app notifications (EXPERT_REVIEW Area 3, SME R3 / R6): `user_notifications` per user and plant, one row
 * per user and dedupe key (the SLA escalation job's idempotency), read / unread, RLS `tenant_isolation`. No
 * e-mail or SMS delivery.
 */
export class UserNotifications1794060100000 implements MigrationInterface {
  name = 'UserNotifications1794060100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of STATEMENTS) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY tenant_isolation ON "${TABLE}"`);
    await queryRunner.query(`DROP TABLE "${TABLE}"`);
  }
}
