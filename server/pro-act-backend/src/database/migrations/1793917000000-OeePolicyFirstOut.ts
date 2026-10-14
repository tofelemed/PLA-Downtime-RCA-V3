import { MigrationInterface, QueryRunner } from 'typeorm';

const NOTE =
  'SME D7 (2026-10-14): overlapping stops first-out — the stop that started first carries the overlap until it clears';

/**
 * SME D7 (EXPERT_REVIEW §2.1): every `oee_policy` scope (tenant-wide or unit) whose latest version does not
 * say `first_out` gets a new version — the latest body with `overlapAllocation: first_out` — effective
 * from the migration instant. Resolution takes the highest version in force at an instant, so periods
 * before this instant keep the version they were calculated with (effective-dated, SME Q7). `down` removes
 * the versions this migration wrote.
 */
export class OeePolicyFirstOut1793917000000 implements MigrationInterface {
  name = 'OeePolicyFirstOut1793917000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "accounting_policies"
         ("tenant_id", "row_version", "policy_kind", "unit_id", "scope_key", "version", "body",
          "effective_from", "approved_at", "notes")
       SELECT latest."tenant_id", 1, 'oee_policy', latest."unit_id", latest."scope_key", latest."version" + 1,
              latest."body" || '{"overlapAllocation": "first_out"}'::jsonb, now(), now(), $1
         FROM (SELECT DISTINCT ON ("tenant_id", "scope_key") *
                 FROM "accounting_policies"
                WHERE "policy_kind" = 'oee_policy'
                ORDER BY "tenant_id", "scope_key", "version" DESC) latest
        WHERE latest."body"->>'overlapAllocation' IS DISTINCT FROM 'first_out'`,
      [NOTE],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "accounting_policies" WHERE "policy_kind" = 'oee_policy' AND "notes" = $1`,
      [NOTE],
    );
  }
}
