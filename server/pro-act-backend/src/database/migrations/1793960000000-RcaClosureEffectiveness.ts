import { MigrationInterface, QueryRunner } from 'typeorm';

const NOTE =
  'SME D17 / CA2-CA8 (2026-10-14): any-of RCA triggers (2 h, 1 % of the daily plan, 3 same-mode incidents in 30 d, ' +
  'cumulative bad actor, critical assets halved, safety override; money limit from finance) and the case workflow rules';

/** Keys the D17 / CA version adds when the latest version does not carry them (pilot values). */
const ADDITIONS = {
  lostQuantityShareOfDailyPlan: 0.01,
  repeatMatch: 'asset_and_mode',
  criticalAssets: { criticalities: ['critical'], thresholdFactor: 0.5 },
  cumulative: { windowDays: 90, downtimeSeconds: 28800 },
  consequence: { solTypes: ['Safety'], severities: ['Critical'] },
};

const SHARED_LESSONS_UP = `CREATE FUNCTION rca_shared_lessons(p_tenant uuid, p_limit int, p_before timestamptz, p_before_id uuid)
RETURNS TABLE ("id" uuid, "source_plant" varchar, "title" varchar, "problem_statement" text, "root_cause" text,
               "recommendations" text, "failure_mode" varchar, "equipment_category" varchar, "lesson_status" varchar,
               "shared_at" timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT kb."id", t."name", kb."title", kb."problem_statement", kb."root_cause", kb."recommendations",
         kb."failure_mode", kb."equipment_category", kb."lesson_status", kb."shared_at"
    FROM "rca_knowledge_base" kb
    JOIN "tenants" t ON t."id"::text = kb."tenant_id" AND t."is_active"
   WHERE (app_rls_tenant_ids() IS NULL OR p_tenant::text = ANY (app_rls_tenant_ids()))
     AND t."organization_id" = (SELECT c."organization_id" FROM "tenants" c WHERE c."id" = p_tenant)
     AND kb."tenant_id" <> p_tenant::text
     AND kb."share_scope" = 'organization' AND kb."is_published" AND kb."shared_at" IS NOT NULL
     AND (p_before IS NULL OR (kb."shared_at", kb."id") < (p_before, p_before_id))
   ORDER BY kb."shared_at" DESC, kb."id" DESC
   LIMIT p_limit
$$`;

/**
 * Area 5 (EXPERT_REVIEW RCA-01, RCA-04, RCA-07, RCA-08; SME CA1-CA9, D17):
 * - `rcas`: author, consequence class (CA7), residual-risk disposition, closure request and independent
 *   approval (CA1), the effectiveness verdict frozen at closure.
 * - `rca_actions`: action type, completion files and who verified the completion evidence (CA4).
 * - `rca_trigger_outcome` + `linked_to_case` (CA8: a same-problem firing adds evidence to the open case).
 * - `rca_knowledge_base`: failure mode (similarity), organization sharing and lesson status (CA9), and
 *   `rca_shared_lessons()`: published lessons other plants of the caller's organization chose to share —
 *   SECURITY DEFINER so it can read across the caller's RLS tenants, but only the redacted lesson columns,
 *   only within the organization, and only for a tenant the session is bound to.
 * - every `rca_policy` scope gets a new version (effective now) with the D17 pilot keys it lacks; the D13
 *   one-hour default becomes two hours. Earlier instants keep the version they were evaluated with.
 * `down` removes all of it.
 */
export class RcaClosureEffectiveness1793960000000
  implements MigrationInterface
{
  name = 'RcaClosureEffectiveness1793960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rcas" ADD "created_by" uuid, ADD "consequence_class" character varying(16),
         ADD "residual_risk" text, ADD "closure_requested_by" uuid, ADD "closure_requested_at" TIMESTAMP WITH TIME ZONE,
         ADD "closure_approved_by" uuid, ADD "closure_approved_at" TIMESTAMP WITH TIME ZONE, ADD "closure_note" text,
         ADD "effectiveness_verdict" character varying(24)`,
    );
    await queryRunner.query(
      `ALTER TABLE "rcas" ADD CONSTRAINT "CHK_rcas_consequence_class"
         CHECK ("consequence_class" IS NULL OR "consequence_class" IN ('minor', 'significant', 'major')),
       ADD CONSTRAINT "CHK_rcas_effectiveness_verdict"
         CHECK ("effectiveness_verdict" IS NULL OR "effectiveness_verdict" IN ('effective', 'not_effective', 'insufficient_evidence'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_actions" ADD "action_type" character varying(32), ADD "completion_verified_by" uuid,
         ADD "completion_attachments" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_actions" ADD CONSTRAINT "CHK_rca_actions_action_type" CHECK ("action_type" IS NULL OR
         "action_type" IN ('repair', 'design_change', 'procedure_change', 'instrument_change', 'training', 'other'))`,
    );
    await queryRunner.query(
      `ALTER TYPE "rca_trigger_outcome" ADD VALUE IF NOT EXISTS 'linked_to_case'`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_knowledge_base" ADD "failure_mode" character varying(255),
         ADD "share_scope" character varying(16) NOT NULL DEFAULT 'tenant', ADD "shared_by" uuid,
         ADD "shared_at" TIMESTAMP WITH TIME ZONE, ADD "lesson_status" character varying(24)`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_knowledge_base" ADD CONSTRAINT "CHK_rca_knowledge_base_share_scope"
         CHECK ("share_scope" IN ('tenant', 'organization')),
       ADD CONSTRAINT "CHK_rca_knowledge_base_lesson_status"
         CHECK ("lesson_status" IS NULL OR "lesson_status" IN ('verified_practice', 'caution', 'unverified'))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rca_knowledge_base_shared" ON "rca_knowledge_base" ("shared_at" DESC, "id" DESC)
         WHERE "share_scope" = 'organization'`,
    );
    await queryRunner.query(SHARED_LESSONS_UP);
    await this.policyVersions(queryRunner);
  }

  private async policyVersions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "accounting_policies"
         ("tenant_id", "row_version", "policy_kind", "unit_id", "scope_key", "version", "body",
          "effective_from", "approved_at", "notes")
       SELECT latest."tenant_id", 1, 'rca_policy', latest."unit_id", latest."scope_key", latest."version" + 1,
              $2::jsonb || latest."body"
                || CASE WHEN latest."body"->>'durationThresholdSeconds' = '3600'
                        THEN '{"durationThresholdSeconds": 7200}'::jsonb ELSE '{}'::jsonb END,
              now(), now(), $1
         FROM (SELECT DISTINCT ON ("tenant_id", "scope_key") *
                 FROM "accounting_policies"
                WHERE "policy_kind" = 'rca_policy'
                ORDER BY "tenant_id", "scope_key", "version" DESC) latest
        WHERE latest."body"->>'repeatMatch' IS NULL`,
      [NOTE, JSON.stringify(ADDITIONS)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "accounting_policies" WHERE "policy_kind" = 'rca_policy' AND "notes" = $1`,
      [NOTE],
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS rca_shared_lessons(uuid, int, timestamptz, uuid)`,
    );
    await queryRunner.query(`DROP INDEX "IDX_rca_knowledge_base_shared"`);
    await queryRunner.query(
      `ALTER TABLE "rca_knowledge_base" DROP CONSTRAINT "CHK_rca_knowledge_base_lesson_status",
         DROP CONSTRAINT "CHK_rca_knowledge_base_share_scope", DROP COLUMN "lesson_status", DROP COLUMN "shared_at",
         DROP COLUMN "shared_by", DROP COLUMN "share_scope", DROP COLUMN "failure_mode"`,
    );
    await queryRunner.query(
      `UPDATE "rca_trigger_evaluations" SET "outcome" = 'recommended' WHERE "outcome" = 'linked_to_case'`,
    );
    await queryRunner.query(
      `ALTER TYPE "rca_trigger_outcome" RENAME TO "rca_trigger_outcome_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "rca_trigger_outcome" AS ENUM ('recommended', 'case_created', 'suppressed_duplicate')`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_trigger_evaluations" ALTER COLUMN "outcome" TYPE "rca_trigger_outcome"
         USING "outcome"::text::"rca_trigger_outcome"`,
    );
    await queryRunner.query(`DROP TYPE "rca_trigger_outcome_old"`);
    await queryRunner.query(
      `ALTER TABLE "rca_actions" DROP CONSTRAINT "CHK_rca_actions_action_type",
         DROP COLUMN "completion_attachments", DROP COLUMN "completion_verified_by", DROP COLUMN "action_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rcas" DROP CONSTRAINT "CHK_rcas_effectiveness_verdict", DROP CONSTRAINT "CHK_rcas_consequence_class",
         DROP COLUMN "effectiveness_verdict", DROP COLUMN "closure_note", DROP COLUMN "closure_approved_at",
         DROP COLUMN "closure_approved_by", DROP COLUMN "closure_requested_at", DROP COLUMN "closure_requested_by",
         DROP COLUMN "residual_risk", DROP COLUMN "consequence_class", DROP COLUMN "created_by"`,
    );
  }
}
