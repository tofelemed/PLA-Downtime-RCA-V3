import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SME D12 / D13 on `production_events`: `investigation_pending` (a stop explicitly under investigation, no
 * specific reason yet), and the staged verification of stop coding — supervisor verification
 * (`verified_by` / `verified_at`) and maintenance validation of the technical failure detail
 * (`validated_by` / `validated_at`), each pair set together. A partial index serves the unverified stops of a
 * unit. Existing events start unverified and not pending.
 */
export class StopCodingVerification1794130001000 implements MigrationInterface {
  name = 'StopCodingVerification1794130001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "investigation_pending" boolean NOT NULL DEFAULT false, ` +
        `ADD "verified_by" uuid, ADD "verified_at" TIMESTAMP WITH TIME ZONE, ` +
        `ADD "validated_by" uuid, ADD "validated_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD CONSTRAINT "CHK_production_events_verification" CHECK (` +
        `("verified_by" IS NULL) = ("verified_at" IS NULL) AND ("validated_by" IS NULL) = ("validated_at" IS NULL))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_unverified_stops" ON "production_events" ("tenant_id", "unit_id", "start_time") ` +
        `WHERE "physical_type" = 'downtime' AND "verified_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_production_events_unverified_stops"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP CONSTRAINT "CHK_production_events_verification"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "validated_at", DROP COLUMN "validated_by", ` +
        `DROP COLUMN "verified_at", DROP COLUMN "verified_by", DROP COLUMN "investigation_pending"`,
    );
  }
}
