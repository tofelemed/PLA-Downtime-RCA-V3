import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

/** Tables whose `view` column is `valuation_view` / `valuation_totals_view`, with their unique cell. */
const VIEW_TABLES = [
  {
    table: 'loss_line_valuations',
    type: 'valuation_view',
    unique: 'UQ_loss_line_valuations_line_view_currency',
    columns: '"loss_line_id", "view", "currency"',
  },
  {
    table: 'approved_loss_line_valuations',
    type: 'valuation_view',
    unique: 'UQ_approved_loss_line_valuations_cell',
    columns: '"approved_line_id", "view", "currency"',
  },
  {
    table: 'period_valuation_totals',
    type: 'valuation_totals_view',
    unique: 'UQ_period_valuation_totals_cell',
    columns: '"run_id", "slice_id", "ledger", "kind", "view", "currency"',
  },
  {
    table: 'approved_valuation_totals',
    type: 'valuation_totals_view',
    unique: 'UQ_approved_valuation_totals_cell',
    columns: '"revision_id", "slice_id", "kind", "view", "currency"',
  },
];

const ENUMS: Record<string, { up: string[]; down: string[] }> = {
  valuation_view: {
    up: [
      'contribution_margin',
      'standard_cost',
      'cost_per_hour',
      'economic_impact',
    ],
    down: ['contribution_margin', 'standard_cost', 'cost_per_hour'],
  },
  valuation_totals_view: {
    up: [
      'contribution_margin',
      'standard_cost',
      'cost_per_hour',
      'economic_impact',
      'independent_components',
    ],
    down: [
      'contribution_margin',
      'standard_cost',
      'cost_per_hour',
      'independent_components',
    ],
  },
  valuation_rate_basis: {
    up: [
      'contribution_margin',
      'standard_cost',
      'cost_per_hour',
      'variable_cost',
      'salvage_value',
      'disposal_cost',
      'downgrade_price_difference',
      'rework_cost',
    ],
    down: ['contribution_margin', 'standard_cost', 'cost_per_hour'],
  },
};

const RATE_EXCLUSION = (withRateType: boolean) =>
  `ALTER TABLE "fx_rates" ADD CONSTRAINT "EX_fx_rates_approved_no_overlap" EXCLUDE USING gist ("tenant_id" WITH =, ` +
  `${withRateType ? '"rate_type" WITH =, ' : ''}"from_currency" WITH =, "to_currency" WITH =, ` +
  `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved')`;

const VALUATION_RATE_EXCLUSION =
  `ALTER TABLE "valuation_rates" ADD CONSTRAINT "EX_valuation_rates_approved_no_overlap" EXCLUDE USING gist ` +
  `((COALESCE("profile_id", "impact_code_id")) WITH =, "basis" WITH =, ` +
  `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved')`;

/**
 * SME V2–V8 (14 Oct 2026, EXPERT_REVIEW VA-03): FX rate tables per purpose (`rate_type`, V5; existing rates
 * are the `economic` table, the no-overlap rule is per table), the product values of the economic view
 * (V2: variable cost, salvage, disposal, downgrade price difference, rework cost), the `economic_impact`
 * view in the stored valuations and totals, and `demand_statuses` (V3: approved sold-out status per
 * product, RLS like every tenant table). Enum types are recreated (a new value is unusable in its own
 * transaction); `down` removes the rows that use the new values first.
 */
export class ValuationFinanceV31793950000000 implements MigrationInterface {
  name = 'ValuationFinanceV31793950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.fxRateType(queryRunner);
    await this.recreateEnums(queryRunner, 'up');
    await this.demandStatuses(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "demand_statuses"`);
    await queryRunner.query(`DROP TYPE "public"."demand_status_state"`);
    await this.removeNewValues(queryRunner);
    await this.recreateEnums(queryRunner, 'down');
    await queryRunner.query(
      `ALTER TABLE "fx_rates" DROP CONSTRAINT "EX_fx_rates_approved_no_overlap"`,
    );
    await queryRunner.query(
      `DELETE FROM "fx_rates" WHERE "rate_type" <> 'economic'`,
    );
    await queryRunner.query(RATE_EXCLUSION(false));
    await queryRunner.query(
      `ALTER TABLE "fx_rates" DROP CONSTRAINT "CHK_fx_rates_rate_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fx_rates_tenant_type_pair_from"`,
    );
    await queryRunner.query(`ALTER TABLE "fx_rates" DROP COLUMN "rate_type"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_fx_rates_tenant_pair_from" ON "fx_rates" ("tenant_id", "from_currency", "to_currency", "effective_from") `,
    );
  }

  private async fxRateType(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fx_rates_tenant_pair_from"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fx_rates" ADD "rate_type" character varying(20) NOT NULL DEFAULT 'economic'`,
    );
    await queryRunner.query(
      `ALTER TABLE "fx_rates" ADD CONSTRAINT "CHK_fx_rates_rate_type" CHECK ("rate_type" IN ('economic', 'group_reporting', 'budget'))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fx_rates_tenant_type_pair_from" ON "fx_rates" ("tenant_id", "rate_type", "from_currency", "to_currency", "effective_from") `,
    );
    await queryRunner.query(
      `ALTER TABLE "fx_rates" DROP CONSTRAINT "EX_fx_rates_approved_no_overlap"`,
    );
    await queryRunner.query(RATE_EXCLUSION(true));
  }

  /** Each enum is renamed once, recreated with the target values and every column moved over. */
  private async recreateEnums(
    queryRunner: QueryRunner,
    direction: 'up' | 'down',
  ): Promise<void> {
    for (const { table, unique } of VIEW_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "${unique}"`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "valuation_rates" DROP CONSTRAINT "EX_valuation_rates_approved_no_overlap"`,
    );
    for (const [type, values] of Object.entries(ENUMS)) {
      const list = values[direction].map((v) => `'${v}'`).join(', ');
      await queryRunner.query(
        `ALTER TYPE "public"."${type}" RENAME TO "${type}_old"`,
      );
      await queryRunner.query(
        `CREATE TYPE "public"."${type}" AS ENUM(${list})`,
      );
      const columns =
        type === 'valuation_rate_basis'
          ? [{ table: 'valuation_rates', column: 'basis' }]
          : VIEW_TABLES.filter((t) => t.type === type).map((t) => ({
              table: t.table,
              column: 'view',
            }));
      for (const { table, column } of columns) {
        await queryRunner.query(
          `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE "public"."${type}" USING "${column}"::"text"::"public"."${type}"`,
        );
      }
      await queryRunner.query(`DROP TYPE "public"."${type}_old"`);
    }
    await queryRunner.query(VALUATION_RATE_EXCLUSION);
    for (const { table, unique, columns } of VIEW_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${unique}" UNIQUE (${columns})`,
      );
    }
  }

  /** Rows of the new view and bases (immutable tables: user triggers off for the delete only). */
  private async removeNewValues(queryRunner: QueryRunner): Promise<void> {
    for (const { table } of VIEW_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE TRIGGER USER`);
      await queryRunner.query(
        `DELETE FROM "${table}" WHERE "view"::text = 'economic_impact'`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE TRIGGER USER`);
    }
    const kept = ENUMS.valuation_rate_basis.down
      .map((v) => `'${v}'`)
      .join(', ');
    await queryRunner.query(
      `DELETE FROM "valuation_rates" WHERE "basis"::text NOT IN (${kept})`,
    );
  }

  private async demandStatuses(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."demand_status_state" AS ENUM('draft', 'approved', 'retired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "demand_statuses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "product_id" uuid NOT NULL, "status" character varying(20) NOT NULL, "evidence" text NOT NULL, "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, "state" "public"."demand_status_state" NOT NULL DEFAULT 'draft', "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_demand_statuses_approved_at" CHECK ("state" <> 'approved' OR "approved_at" IS NOT NULL), CONSTRAINT "CHK_demand_statuses_effective" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), CONSTRAINT "CHK_demand_statuses_status" CHECK ("status" IN ('demand_constrained', 'not_constrained')), CONSTRAINT "EX_demand_statuses_approved_no_overlap" EXCLUDE USING gist ("tenant_id" WITH =, "product_id" WITH =, tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved'), CONSTRAINT "PK_addaa378e68e83164d949f8611a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3bf8a35c31c8c280c1a65451d8" ON "demand_statuses" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_demand_statuses_product" ON "demand_statuses" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_demand_statuses_tenant_product_from" ON "demand_statuses" ("tenant_id", "product_id", "effective_from") `,
    );
    await queryRunner.query(
      `ALTER TABLE "demand_statuses" ADD CONSTRAINT "FK_demand_statuses_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE POLICY tenant_isolation ON "demand_statuses" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
    );
    await queryRunner.query(
      `ALTER TABLE "demand_statuses" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "demand_statuses" FORCE ROW LEVEL SECURITY`,
    );
  }
}
