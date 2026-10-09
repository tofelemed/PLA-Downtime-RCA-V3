import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan 3.1 step 5: per-tenant feature flags (`feature_flags`), one row per tenant and key, so pilot
 * units switch a screen between its v1 and v2 binding without a redeploy (MIG02/MIG05). Generated from
 * the entity, reviewed; `down()` drops the table.
 */
export class FeatureFlags1792966400000 implements MigrationInterface {
  name = 'FeatureFlags1792966400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "feature_flags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "key" character varying(64) NOT NULL, "enabled" boolean NOT NULL, CONSTRAINT "PK_db657d344e9caacfc9d5cf8bbac" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b0564fcd9cfb5b4b9bd00429de" ON "feature_flags" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_feature_flags_tenant_key" ON "feature_flags" ("tenant_id", "key") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_feature_flags_tenant_key"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b0564fcd9cfb5b4b9bd00429de"`,
    );
    await queryRunner.query(`DROP TABLE "feature_flags"`);
  }
}
