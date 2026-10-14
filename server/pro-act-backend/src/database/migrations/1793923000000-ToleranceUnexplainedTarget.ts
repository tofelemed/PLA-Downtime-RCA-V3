import { MigrationInterface, QueryRunner } from 'typeorm';

const NOTE =
  'SME R7 (2026-10-14): improvement target — unexplained loss below 2 % of the shortfall (reporting only, not the approval tolerance)';

/**
 * SME R7 (EXPERT_REVIEW §3.1): every `reconciliation_tolerance` scope whose latest version has no
 * `unaccountedTargetOfShortfall` gets a new version — the latest body plus the 0.02 target — effective from
 * the migration instant, so earlier periods keep the version they were calculated with (as in
 * OeePolicyFirstOut). The target only feeds the reconciliation trend; submission still uses the tolerance.
 * `down` removes the versions this migration wrote.
 */
export class ToleranceUnexplainedTarget1793923000000
  implements MigrationInterface
{
  name = 'ToleranceUnexplainedTarget1793923000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "accounting_policies"
         ("tenant_id", "row_version", "policy_kind", "unit_id", "scope_key", "version", "body",
          "effective_from", "approved_at", "notes")
       SELECT latest."tenant_id", 1, 'reconciliation_tolerance', latest."unit_id", latest."scope_key",
              latest."version" + 1, latest."body" || '{"unaccountedTargetOfShortfall": 0.02}'::jsonb,
              now(), now(), $1
         FROM (SELECT DISTINCT ON ("tenant_id", "scope_key") *
                 FROM "accounting_policies"
                WHERE "policy_kind" = 'reconciliation_tolerance'
                ORDER BY "tenant_id", "scope_key", "version" DESC) latest
        WHERE NOT (latest."body" ? 'unaccountedTargetOfShortfall')`,
      [NOTE],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "accounting_policies" WHERE "policy_kind" = 'reconciliation_tolerance' AND "notes" = $1`,
      [NOTE],
    );
  }
}
