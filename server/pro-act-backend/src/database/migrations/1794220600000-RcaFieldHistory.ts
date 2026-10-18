import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RCA field history (item 2): case commands append `audit_log` rows whose `detail.caseId` names the case
 * (also for actions, links, analyses and causes). `GET /v2/rcas/{id}/history` reads them newest first in
 * keyset pages, served by this partial expression index (declared `synchronize: false` on the entity).
 */
export class RcaFieldHistory1794220600000 implements MigrationInterface {
  name = 'RcaFieldHistory1794220600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_rca_case" ON "audit_log" ("tenant_id", ("detail" ->> 'caseId'), "at", "id")
        WHERE "entity_type" IN ('rca_case', 'rca_action', 'rca_case_link', 'rca_analysis', 'rca_cause')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_audit_log_rca_case"`);
  }
}
