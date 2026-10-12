import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes of the v2 administration API (owner requirement "v2 only"): tasks by due date and by assignee
 * per plant (by creation, `IDX_tasks_tenant_created` of `PlaReportIndexes` serves), the audit trail
 * newest first per plant and by actor, the members of a plant by name, organization-level users, and the
 * foreign key `user_scopes.user_id`. The v1 pages loaded every row unpaged, so nothing indexed these.
 */
export class AdministrationIndexes1793904000000 implements MigrationInterface {
  name = 'AdministrationIndexes1793904000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_tenant_due" ON "tasks" ("tenant_id", "due_date", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_tenant_assignee" ON "tasks" ("tenant_id", "assigned_to")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_tenant_time" ON "audit_logs" ("tenant_id", "timestamp", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_tenant_user" ON "audit_logs" ("tenant_id", "user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_tenant_name" ON "users" ("tenant_id", "name", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_organization" ON "users" ("organization_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_scopes_user" ON "user_scopes" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_user_scopes_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_organization"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_tenant_name"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_tenant_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_tenant_time"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_tenant_assignee"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_tenant_due"`);
  }
}
