import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SME D8 / D11 (EXPERT_REVIEW §2.1): ISO 14224-aligned failure detail on events — severity (`critical`,
 * `degraded`, `incipient`; null = pending investigation), maintainable item, mechanism, cause and detection
 * method next to the existing failure mode (codes free text until the plant's dictionary is loaded).
 * `failure_events_v` counts confirmed functional failures only: an unplanned stop with severity critical or
 * degraded, or with a failure mode and no severity yet; an incipient finding is not a failure.
 */
const ACTIVE = `e."physical_state" IN ('open', 'closed') AND (e."event_type" = 'FailureWO' OR e."physical_type" = 'downtime')`;

const viewSql = (failureStop: string, extra: string) =>
  `CREATE VIEW "failure_events_v" AS SELECT e."tenant_id", e."unit_id", e."occurrence_id", ` +
  `(array_agg(e."asset_id" ORDER BY e."start_time", e."id") FILTER (WHERE e."asset_id" IS NOT NULL))[1] AS "asset_id", ` +
  `min(e."start_time") AS "start_time", ` +
  `CASE WHEN bool_or(e."end_time" IS NULL) THEN NULL ELSE max(e."end_time") END AS "restored_at", ` +
  `NULL::timestamptz AS "repair_start", NULL::timestamptz AS "repair_end", ` +
  `CASE WHEN bool_or(${failureStop}) THEN 'unplanned_stop_with_failure_code' ELSE 'failure_work_order' END AS "source", ` +
  `min(NULLIF(btrim(e."failure_mode"), '')) AS "failure_mode", min(e."work_order_id") AS "work_order_id"${extra} ` +
  `FROM "production_events" e WHERE ${ACTIVE} ` +
  `GROUP BY e."tenant_id", e."unit_id", e."occurrence_id" ` +
  `HAVING bool_or(e."event_type" = 'FailureWO') OR bool_or(${failureStop})`;

const UNPLANNED = `e."physical_type" = 'downtime' AND e."schedule_class" = 'unplanned'`;
const CODED = `NULLIF(btrim(e."failure_mode"), '') IS NOT NULL`;
const BEFORE = `${UNPLANNED} AND ${CODED}`;
const CONFIRMED = `${UNPLANNED} AND (e."failure_severity" IN ('critical', 'degraded') OR (e."failure_severity" IS NULL AND ${CODED}))`;
const SEVERITY = `, (array_agg(e."failure_severity" ORDER BY e."start_time", e."id") FILTER (WHERE e."failure_severity" IS NOT NULL))[1] AS "failure_severity"`;

export class FailureDetail1793921000000 implements MigrationInterface {
  name = 'FailureDetail1793921000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "failure_severity" character varying(16), ` +
        `ADD "maintainable_item" character varying(100), ADD "failure_mechanism" character varying(100), ` +
        `ADD "failure_cause" character varying(100), ADD "detection_method" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD CONSTRAINT "CHK_production_events_failure_severity" ` +
        `CHECK ("failure_severity" IS NULL OR "failure_severity" IN ('critical', 'degraded', 'incipient'))`,
    );
    await queryRunner.query(`DROP VIEW "failure_events_v"`);
    await queryRunner.query(viewSql(CONFIRMED, SEVERITY));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW "failure_events_v"`);
    await queryRunner.query(viewSql(BEFORE, ''));
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP CONSTRAINT "CHK_production_events_failure_severity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "detection_method", DROP COLUMN "failure_cause", ` +
        `DROP COLUMN "failure_mechanism", DROP COLUMN "maintainable_item", DROP COLUMN "failure_severity"`,
    );
  }
}
