import { MigrationInterface, QueryRunner } from 'typeorm';

const TYPE = 'valuation_rate_basis';

const BASES = [
  'contribution_margin',
  'standard_cost',
  'cost_per_hour',
  'variable_cost',
  'salvage_value',
  'disposal_cost',
  'downgrade_price_difference',
  'rework_cost',
];
const UP_BASES = [...BASES, 'rework_yield'];

const EXCLUSION = 'EX_valuation_rates_approved_no_overlap';
const ADD_EXCLUSION =
  `ALTER TABLE "valuation_rates" ADD CONSTRAINT "${EXCLUSION}" EXCLUDE USING gist ` +
  `((COALESCE("profile_id", "impact_code_id")) WITH =, "basis" WITH =, ` +
  `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved')`;

const CHECKS: ReadonlyArray<[name: string, definition: string]> = [
  [
    'CHK_valuation_rates_ratio_currency',
    `("basis"::text = 'rework_yield') = ("currency" IS NULL)`,
  ],
  [
    'CHK_valuation_rates_yield_range',
    `"basis"::text <> 'rework_yield' OR ("value" > 0 AND "value" <= 1)`,
  ],
];

/**
 * SME V2 remainder (valuation 2.8.0): the `rework_yield` valuation rate basis — recovered tonnes per
 * reworked tonne of a profile (0 < value ≤ 1), finance maintained and approved like every valuation rate.
 * A ratio has no currency, so `currency` becomes nullable for that basis only (CHECK). The enum type is
 * recreated (a new value is unusable in its own transaction); `down` removes the yield rows first.
 */
export class ReworkYieldRate1794110000000 implements MigrationInterface {
  name = 'ReworkYieldRate1794110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.recreateBasis(queryRunner, UP_BASES);
    await queryRunner.query(
      `ALTER TABLE "valuation_rates" ALTER COLUMN "currency" DROP NOT NULL`,
    );
    for (const [name, definition] of CHECKS) {
      await queryRunner.query(
        `ALTER TABLE "valuation_rates" ADD CONSTRAINT "${name}" CHECK (${definition})`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "valuation_rates" WHERE "basis"::text = 'rework_yield'`,
    );
    for (const [name] of [...CHECKS].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "valuation_rates" DROP CONSTRAINT "${name}"`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "valuation_rates" ALTER COLUMN "currency" SET NOT NULL`,
    );
    await this.recreateBasis(queryRunner, BASES);
  }

  private async recreateBasis(
    queryRunner: QueryRunner,
    values: readonly string[],
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "valuation_rates" DROP CONSTRAINT "${EXCLUSION}"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."${TYPE}" RENAME TO "${TYPE}_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."${TYPE}" AS ENUM(${values.map((v) => `'${v}'`).join(', ')})`,
    );
    await queryRunner.query(
      `ALTER TABLE "valuation_rates" ALTER COLUMN "basis" TYPE "public"."${TYPE}" USING "basis"::"text"::"public"."${TYPE}"`,
    );
    await queryRunner.query(`DROP TYPE "public"."${TYPE}_old"`);
    await queryRunner.query(ADD_EXCLUSION);
  }
}
