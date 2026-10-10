import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan 3.8 (spec NFR02, §16.2 AdminPanel): declarative admin rules. `rules` (identity, kind, state,
 * version in force, editable draft), `rule_versions` (immutable approved definitions; activation and
 * rollback only add rows) and `rule_runs` (simulations with their scope and before/after results).
 * Generated from the entities against a scratch database, reviewed; `down()` drops the three tables
 * and their enum types, and the (tenant, reason code, start) index of `production_events`.
 */
export class DeclarativeRules1793052800000 implements MigrationInterface {
  name = 'DeclarativeRules1793052800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."rule_kind" AS ENUM('coding_default', 'status_derivation', 'rca_trigger_hint', 'validation')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."rule_state" AS ENUM('draft', 'active', 'retired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "kind" "public"."rule_kind" NOT NULL, "name" character varying(120) NOT NULL, "description" text, "priority" integer NOT NULL DEFAULT '100', "state" "public"."rule_state" NOT NULL, "active_version" integer, "draft_definition" jsonb, "draft_author" uuid, "draft_updated_at" TIMESTAMP WITH TIME ZONE, "retired_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_rules_tenant_name" UNIQUE ("tenant_id", "name"), CONSTRAINT "PK_10fef696a7d61140361b1b23608" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f1e5726c50ef2a632e178103c8" ON "rules" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rules_tenant_kind_state" ON "rules" ("tenant_id", "kind", "state") `,
    );
    await queryRunner.query(
      `CREATE TABLE "rule_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "rule_id" uuid NOT NULL, "version" integer, "definition" jsonb NOT NULL, "sample_scope" jsonb NOT NULL, "results" jsonb NOT NULL, "ran_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_4f745fc3fa413d75d7dc13b2c51" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c1110e5c2256f1e42a8927483b" ON "rule_runs" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rule_runs_tenant_rule_ran" ON "rule_runs" ("tenant_id", "rule_id", "ran_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."rule_version_origin" AS ENUM('activation', 'rollback')`,
    );
    await queryRunner.query(
      `CREATE TABLE "rule_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "rule_id" uuid NOT NULL, "version" integer NOT NULL, "definition" jsonb NOT NULL, "origin" "public"."rule_version_origin" NOT NULL, "restored_version" integer, "authored_by" uuid, "approved_by" uuid NOT NULL, "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "reason" text, CONSTRAINT "UQ_rule_versions_rule_version" UNIQUE ("rule_id", "version"), CONSTRAINT "PK_f94078d9fb0f85dcdf3ceaec3ec" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1badad0d8d18d45cb93eeee6ae" ON "rule_versions" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rule_versions_tenant_rule" ON "rule_versions" ("tenant_id", "rule_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_runs" ADD CONSTRAINT "FK_0f381bd68d24644837a0d7861fb" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_versions" ADD CONSTRAINT "FK_d13d4a69ecdb5acf7b1df3bbf6c" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    // mapping preview / references: events coded with a reason code in a window (plan 3.8)
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_tenant_reason_start" ON "production_events" ("tenant_id", "reason_code_id", "start_time") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_production_events_tenant_reason_start"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_versions" DROP CONSTRAINT "FK_d13d4a69ecdb5acf7b1df3bbf6c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_runs" DROP CONSTRAINT "FK_0f381bd68d24644837a0d7861fb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_rule_versions_tenant_rule"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1badad0d8d18d45cb93eeee6ae"`,
    );
    await queryRunner.query(`DROP TABLE "rule_versions"`);
    await queryRunner.query(`DROP TYPE "public"."rule_version_origin"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_rule_runs_tenant_rule_ran"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c1110e5c2256f1e42a8927483b"`,
    );
    await queryRunner.query(`DROP TABLE "rule_runs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_rules_tenant_kind_state"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f1e5726c50ef2a632e178103c8"`,
    );
    await queryRunner.query(`DROP TABLE "rules"`);
    await queryRunner.query(`DROP TYPE "public"."rule_state"`);
    await queryRunner.query(`DROP TYPE "public"."rule_kind"`);
  }
}
