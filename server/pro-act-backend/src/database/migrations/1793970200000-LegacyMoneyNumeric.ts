import { MigrationInterface, QueryRunner } from 'typeorm';

/** Legacy money columns stored as `double precision` (table, column). */
const MONEY_COLUMNS: ReadonlyArray<[string, string]> = [
  ['loss_categories', 'lossAmount'],
  ['reconcile_forms', 'totalLossAmount'],
  ['reconcile_forms', 'categorizedLossAmount'],
  ['reconcile_forms', 'unaccountedLossAmount'],
  ['rca_recommendations', 'estimatedCost'],
  ['rca_recommendations', 'actualCost'],
  ['rca_knowledge_base', 'cost_saved'],
];

/**
 * DB-11 (expert review): legacy money in binary floating point (`0.1 + 0.2` problems, inexact sums).
 * Converted in place to `numeric(28,8)`, the precision of the valuation amounts; `registerPgTypeParsers`
 * still hands numbers to the services, so callers see no change. The dev database holds 28 rows (all
 * `cost_saved` null); `USING col::numeric(28,8)` fails loudly on NaN / ±Infinity or values ≥ 1e20
 * instead of silently changing them. Non-money floats (historian thresholds, stream metrics,
 * effectiveness ratios) stay `double precision`.
 */
export class LegacyMoneyNumeric1793970200000 implements MigrationInterface {
  name = 'LegacyMoneyNumeric1793970200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of MONEY_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE numeric(28,8) USING "${column}"::numeric(28,8)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of MONEY_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE double precision USING "${column}"::double precision`,
      );
    }
  }
}
