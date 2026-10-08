import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan 1.6 (PI03, PI04, PI06, step 5): page manifests of PI window reads, the open-frame tracker, and
 * the crosswalk from v1 `pi_sync_jobs` to the leased ingestion jobs that replace the legacy pull. PI
 * connections now declare confirmed deletions (inventory comparison) as a capability.
 */
export class PiCertifiedIntake1792016000000 implements MigrationInterface {
  name = 'PiCertifiedIntake1792016000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "pi_sync_job_links" ("pi_sync_job_id" uuid NOT NULL, "tenant_id" uuid NOT NULL, ` +
        `"ingestion_job_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_39f1f21950ed2ad2d7e5f8ab845" PRIMARY KEY ("pi_sync_job_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pi_sync_job_links_ingestion_job" ON "pi_sync_job_links" ("ingestion_job_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "pi_open_frames" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
        `"connection_id" uuid NOT NULL, "web_id" text NOT NULL, "start_time" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"raw_end_time" text, "last_polled_at" TIMESTAMP WITH TIME ZONE, ` +
        `"first_seen" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "UQ_pi_open_frames_connection_web_id" UNIQUE ("connection_id", "web_id"), ` +
        `CONSTRAINT "PK_08b129fae6af357741cca7746f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pi_open_frames_connection_polled" ON "pi_open_frames" ("connection_id", "last_polled_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "pi_page_manifests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
        `"job_id" uuid NOT NULL, "window_start" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"window_end" TIMESTAMP WITH TIME ZONE NOT NULL, "page_index" integer NOT NULL, ` +
        `"start_index" integer NOT NULL, "item_count" integer, "outcome" character varying(16) NOT NULL, ` +
        `"attempts" integer NOT NULL DEFAULT '1', "error" text, ` +
        `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "UQ_pi_page_manifests_job_window_page" UNIQUE ("job_id", "window_start", "window_end", "page_index"), ` +
        `CONSTRAINT "PK_3e357eb62ca124f225fe223bdd8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pi_page_manifests_tenant" ON "pi_page_manifests" ("tenant_id") `,
    );
    await this.addForeignKeys(queryRunner);
    await queryRunner.query(
      `UPDATE "integration_connections" SET "capabilities" = "capabilities" || '{"deletions": true}'::jsonb
        WHERE "source_type" = 'pi_web_api'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "integration_connections" SET "capabilities" = ("capabilities" - 'batch') || '{"deletions": false}'::jsonb
        WHERE "source_type" = 'pi_web_api'`,
    );
    await queryRunner.query(
      `ALTER TABLE "pi_page_manifests" DROP CONSTRAINT "FK_6f4de7ac39c3d3cda159aad6073"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pi_open_frames" DROP CONSTRAINT "FK_b65aa7f6d6c1f6338c39ca15fca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pi_sync_job_links" DROP CONSTRAINT "FK_6a426a3477b8386a211fd100bf7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pi_sync_job_links" DROP CONSTRAINT "FK_39f1f21950ed2ad2d7e5f8ab845"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pi_page_manifests_tenant"`,
    );
    await queryRunner.query(`DROP TABLE "pi_page_manifests"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pi_open_frames_connection_polled"`,
    );
    await queryRunner.query(`DROP TABLE "pi_open_frames"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pi_sync_job_links_ingestion_job"`,
    );
    await queryRunner.query(`DROP TABLE "pi_sync_job_links"`);
  }

  private async addForeignKeys(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pi_sync_job_links" ADD CONSTRAINT "FK_39f1f21950ed2ad2d7e5f8ab845" FOREIGN KEY ("pi_sync_job_id") ` +
        `REFERENCES "pi_sync_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pi_sync_job_links" ADD CONSTRAINT "FK_6a426a3477b8386a211fd100bf7" FOREIGN KEY ("ingestion_job_id") ` +
        `REFERENCES "ingestion_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pi_open_frames" ADD CONSTRAINT "FK_b65aa7f6d6c1f6338c39ca15fca" FOREIGN KEY ("connection_id") ` +
        `REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pi_page_manifests" ADD CONSTRAINT "FK_6f4de7ac39c3d3cda159aad6073" FOREIGN KEY ("job_id") ` +
        `REFERENCES "ingestion_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
