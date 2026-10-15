import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = ['loss_line_valuations', 'approved_loss_line_valuations'];

/**
 * VA-04 (economic view by component): `components` jsonb on the normalized line valuations of a run and of
 * an approved revision — the line's economic parts in that reporting currency, written with the row from
 * valuation 2.8.0 on. Nullable: existing (immutable) rows keep no breakdown and are reported as
 * `not_broken_down`, so the parts still add up to the reported total.
 */
export class ValuationComponentBreakdown1794110100000
  implements MigrationInterface
{
  name = 'ValuationComponentBreakdown1794110100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "components" jsonb`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "components"`,
      );
    }
  }
}
