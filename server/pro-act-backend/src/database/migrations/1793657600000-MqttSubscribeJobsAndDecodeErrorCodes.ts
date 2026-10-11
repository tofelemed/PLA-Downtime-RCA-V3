import { MigrationInterface, QueryRunner } from 'typeorm';

/** The codes of plan 1.5 / 1.7 (`IntakeCore`, `SignalsAndSamples`), in enum order. */
const ERROR_CODES_1_7 =
  `'unknown_template', 'unknown_code', 'unknown_unit', 'mapping_ambiguous', 'mapping_invalid_target', ` +
  `'schema_invalid', 'unit_conflict', 'duration_conflict', 'order_conflict', 'no_handler', 'processing_failed', ` +
  `'unknown_signal'`;

/** MQTT decode rejections (plan 1.8 design §4.2 stages 2, 4, 7, 9; `DECODE_FAILURE_CODES`). */
const MQTT_DECODE_CODES = [
  'topic_shape',
  'not_json',
  'too_large',
  'unsupported_version',
  'identity_mismatch',
  'future_timestamp',
  'stale_timestamp',
  'topic_not_allowed',
  'unmapped_value',
];

/**
 * Plan 1.8 WP3 step 3 (MQTT subscriber host): the quarantine enum gains one code per decode rejection
 * so a poison or out-of-contract message is parked with the exact reason, and `ingestion_jobs.next_run_at`
 * becomes nullable: a subscription job (`scope.mode = 'subscribe'`) is never due, so the pull runner
 * (`claimDueJob`, `next_run_at <= now()`) can never claim it. The enum is rebuilt (not `ADD VALUE`) so the
 * migration stays revertible, as in `SignalsAndSamples`.
 */
export class MqttSubscribeJobsAndDecodeErrorCodes1793657600000
  implements MigrationInterface
{
  name = 'MqttSubscribeJobsAndDecodeErrorCodes1793657600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.rebuildErrorCodes(
      queryRunner,
      `${ERROR_CODES_1_7}, ${MQTT_DECODE_CODES.map((code) => `'${code}'`).join(', ')}`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ALTER COLUMN "next_run_at" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "ingestion_jobs" SET "next_run_at" = now() WHERE "next_run_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ALTER COLUMN "next_run_at" SET NOT NULL`,
    );
    // rows parked with an MQTT decode code cannot be expressed by the old enum (raw rows are kept)
    await queryRunner.query(
      `DELETE FROM "ingestion_exceptions" WHERE "error_code"::text = ANY($1)`,
      [MQTT_DECODE_CODES],
    );
    await this.rebuildErrorCodes(queryRunner, ERROR_CODES_1_7);
  }

  private async rebuildErrorCodes(
    queryRunner: QueryRunner,
    values: string,
  ): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_ingestion_exceptions_open_object_code"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."ingestion_error_code" RENAME TO "ingestion_error_code_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ingestion_error_code" AS ENUM(${values})`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_exceptions" ALTER COLUMN "error_code" TYPE "public"."ingestion_error_code" ` +
        `USING "error_code"::"text"::"public"."ingestion_error_code"`,
    );
    await queryRunner.query(`DROP TYPE "public"."ingestion_error_code_old"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ingestion_exceptions_open_object_code" ON "ingestion_exceptions" ` +
        `("tenant_id", "connection_id", "source_object_id", "error_code") WHERE "state" = 'open'`,
    );
  }
}
