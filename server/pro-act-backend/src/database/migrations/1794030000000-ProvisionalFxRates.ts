import { MigrationInterface, QueryRunner } from 'typeorm';

const EXCLUSION = (name: string, where: string) =>
  `ALTER TABLE "fx_rates" ADD CONSTRAINT "${name}" EXCLUDE USING gist ("tenant_id" WITH =, "rate_type" WITH =, ` +
  `"from_currency" WITH =, "to_currency" WITH =, tstzrange("effective_from", "effective_to", '[)') WITH &&) ` +
  `WHERE (${where})`;

const FINAL = `"state" = 'approved' AND NOT "provisional"`;
const PROVISIONAL = `"state" = 'approved' AND "provisional"`;
const ANY_APPROVED = `"state" = 'approved'`;

/**
 * SME V7 (14 Oct 2026) provisional FX rates: finance may author and authorise a provisional rate where
 * the approved rate of a date is missing (`fx_rates.provisional`). Final approved versions of a pair
 * never overlap each other, nor do provisional ones; a final rate may cover a provisional one and wins.
 * Values converted with a provisional rate carry the mark (`provisional` per line value, the count per
 * total). `down` refuses while provisional rates exist rather than silently dropping them.
 */
export class ProvisionalFxRates1794030000000 implements MigrationInterface {
  name = 'ProvisionalFxRates1794030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fx_rates" ADD "provisional" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "fx_rates" DROP CONSTRAINT "EX_fx_rates_approved_no_overlap"`,
    );
    await queryRunner.query(
      EXCLUSION('EX_fx_rates_approved_no_overlap', FINAL),
    );
    await queryRunner.query(
      EXCLUSION('EX_fx_rates_provisional_no_overlap', PROVISIONAL),
    );
    for (const table of [
      'loss_line_valuations',
      'approved_loss_line_valuations',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "provisional" boolean NOT NULL DEFAULT false`,
      );
    }
    for (const table of [
      'period_valuation_totals',
      'approved_valuation_totals',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "fx_provisional_lines" integer NOT NULL DEFAULT 0`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ n: number }> = await queryRunner.query(
      `SELECT count(*)::int AS "n" FROM "fx_rates" WHERE "provisional"`,
    );
    if ((rows[0]?.n ?? 0) > 0) {
      throw new Error(
        'provisional FX rates exist: retire or delete them before reverting ProvisionalFxRates',
      );
    }
    for (const table of [
      'approved_valuation_totals',
      'period_valuation_totals',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "fx_provisional_lines"`,
      );
    }
    for (const table of [
      'approved_loss_line_valuations',
      'loss_line_valuations',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "provisional"`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "fx_rates" DROP CONSTRAINT "EX_fx_rates_provisional_no_overlap"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fx_rates" DROP CONSTRAINT "EX_fx_rates_approved_no_overlap"`,
    );
    await queryRunner.query(
      EXCLUSION('EX_fx_rates_approved_no_overlap', ANY_APPROVED),
    );
    await queryRunner.query(`ALTER TABLE "fx_rates" DROP COLUMN "provisional"`);
  }
}
