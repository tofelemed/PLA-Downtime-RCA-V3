import { MigrationInterface, QueryRunner } from 'typeorm';

const POLICY_EXPRESSION = `app_rls_tenant_ids() IS NULL OR tenant_id IS NULL OR tenant_id::text = ANY (app_rls_tenant_ids())`;

/**
 * RCA knowledge base on v2 (owner decision 2026-10-12):
 * - `rca_knowledge_base` gains `row_version` (If-Match on publish / unpublish; existing rows start at 1)
 *   and `published_at` / `published_by`;
 * - composite indexes for the v2 list (tenant, created_at, id keyset), the unit / asset filters and the
 *   similar-cases lookup, and the case → entry lookup on close (tenant, rca_id);
 * - `rca_knowledge_votes`: one helpful / not-helpful vote per user and entry, deleted with the entry,
 *   with the plan 3.11 `tenant_isolation` row-level-security policy.
 */
export class RcaKnowledgeV21793746800000 implements MigrationInterface {
  name = 'RcaKnowledgeV21793746800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "rca_knowledge_votes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "entry_id" uuid NOT NULL, "user_id" uuid NOT NULL, "helpful" boolean NOT NULL, CONSTRAINT "PK_8eb3d07d00d510ba22541e13deb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_afc84c794ebf8dc2255356d9ac" ON "rca_knowledge_votes" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_rca_knowledge_votes_entry_user" ON "rca_knowledge_votes" ("entry_id", "user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_knowledge_votes" ADD CONSTRAINT "FK_7463017744d7e1410587fa8cf74" FOREIGN KEY ("entry_id") REFERENCES "rca_knowledge_base"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE POLICY tenant_isolation ON "rca_knowledge_votes" USING (${POLICY_EXPRESSION}) WITH CHECK (${POLICY_EXPRESSION})`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_knowledge_votes" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_knowledge_votes" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_knowledge_base" ADD "row_version" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_knowledge_base" ADD "published_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_knowledge_base" ADD "published_by" character varying(36)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rca_knowledge_base_tenant_rca" ON "rca_knowledge_base" ("tenant_id", "rca_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rca_knowledge_base_tenant_asset" ON "rca_knowledge_base" ("tenant_id", "asset_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rca_knowledge_base_tenant_unit" ON "rca_knowledge_base" ("tenant_id", "unit_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rca_knowledge_base_tenant_created" ON "rca_knowledge_base" ("tenant_id", "created_at", "id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_rca_knowledge_base_tenant_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_rca_knowledge_base_tenant_unit"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_rca_knowledge_base_tenant_asset"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_rca_knowledge_base_tenant_rca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_knowledge_base" DROP COLUMN "published_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_knowledge_base" DROP COLUMN "published_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_knowledge_base" DROP COLUMN "row_version"`,
    );
    await queryRunner.query(
      `DROP POLICY tenant_isolation ON "rca_knowledge_votes"`,
    );
    await queryRunner.query(`DROP TABLE "rca_knowledge_votes"`);
  }
}
