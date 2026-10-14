import { MigrationInterface, QueryRunner } from 'typeorm';

const NOTE =
  'SME V1-V8 (2026-10-14): economic view by default, lost sales only when demand is constrained, FX economic table at the event date, manual downtime hours from evidenced events. Unapproved until a finance approver signs it off.';

/** `contracts/policies/defaults/valuation_basis.v3.default.json` body, frozen as of this migration. */
const BODY = {
  defaultBasis: 'economic_impact',
  timeBasisRule: 'exclusive',
  reportingCurrencies: ['IRR', 'USD'],
  fxPolicy: 'snapshot',
  independentImpactCodeIds: [],
  fxRateType: 'economic',
  fxDateRule: 'event_date',
  fxAverageMaxDeviation: '0.05',
  demandRule: 'demand_constrained_only',
  qualityDispositions: {},
  defaultQualityDisposition: null,
  manualLineHours: true,
};

/**
 * SME V1–V8 (EXPERT_REVIEW VA-03): every tenant with a `valuation_basis` history gets version 3 — the
 * pilot settings of the SME answers, keeping the tenant's reporting currencies — effective from the
 * migration instant and **unapproved**: valuation keeps applying the highest approved version until a
 * finance approver signs version 3 off (V1), so nothing already calculated changes. `down` removes the
 * versions this migration wrote.
 */
export class ValuationPolicyV31793950100000 implements MigrationInterface {
  name = 'ValuationPolicyV31793950100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "accounting_policies"
         ("tenant_id", "row_version", "policy_kind", "unit_id", "scope_key", "version", "body",
          "effective_from", "approved_at", "notes")
       SELECT latest."tenant_id", 1, 'valuation_basis', NULL, 'tenant', latest."version" + 1,
              $1::jsonb || jsonb_build_object('reportingCurrencies',
                COALESCE(latest."body"->'reportingCurrencies', '["IRR", "USD"]'::jsonb)),
              now(), NULL, $2
         FROM (SELECT DISTINCT ON ("tenant_id") *
                 FROM "accounting_policies"
                WHERE "policy_kind" = 'valuation_basis' AND "scope_key" = 'tenant'
                ORDER BY "tenant_id", "version" DESC) latest
        WHERE latest."body"->>'demandRule' IS NULL`,
      [JSON.stringify(BODY), NOTE],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "accounting_policies" WHERE "policy_kind" = 'valuation_basis' AND "notes" = $1`,
      [NOTE],
    );
  }
}
