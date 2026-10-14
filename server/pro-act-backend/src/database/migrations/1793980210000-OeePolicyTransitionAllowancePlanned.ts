import { MigrationInterface, QueryRunner } from 'typeorm';

const NOTE =
  'LA-08 (2026-10-14): plan targets already deduct the standard grade-transition time (ISO 22400 / GE PLA common practice) — only the overrun is a plan-ledger loss';

/**
 * LA-08 owner decision (common practice): every `oee_policy` scope (tenant-wide or unit) whose latest
 * version does not say `transitionAllowanceInPlan: planned` gets a new version — the latest body with
 * `planned` — effective from the migration instant. Periods before this instant keep the version they were
 * calculated with (a body without the field reads as `loss`), so old runs stay reproducible. `down` removes
 * the versions this migration wrote.
 */
export class OeePolicyTransitionAllowancePlanned1793980210000
  implements MigrationInterface
{
  name = 'OeePolicyTransitionAllowancePlanned1793980210000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "accounting_policies"
         ("tenant_id", "row_version", "policy_kind", "unit_id", "scope_key", "version", "body",
          "effective_from", "approved_at", "notes")
       SELECT latest."tenant_id", 1, 'oee_policy', latest."unit_id", latest."scope_key", latest."version" + 1,
              latest."body" || '{"transitionAllowanceInPlan": "planned"}'::jsonb, now(), now(), $1
         FROM (SELECT DISTINCT ON ("tenant_id", "scope_key") *
                 FROM "accounting_policies"
                WHERE "policy_kind" = 'oee_policy'
                ORDER BY "tenant_id", "scope_key", "version" DESC) latest
        WHERE latest."body"->>'transitionAllowanceInPlan' IS DISTINCT FROM 'planned'`,
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
