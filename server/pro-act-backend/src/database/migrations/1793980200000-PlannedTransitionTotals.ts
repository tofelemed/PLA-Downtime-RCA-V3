import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LA-08 (oee_policy `transitionAllowanceInPlan = planned`): the plan ledger reports the grade-transition
 * allowance its target already allows for as planned transition time on its totals — information, not a
 * loss line. Nullable: older runs and the capacity ledger have none. `down` drops the column.
 */
export class PlannedTransitionTotals1793980200000
  implements MigrationInterface
{
  name = 'PlannedTransitionTotals1793980200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "period_ledger_totals" ADD COLUMN IF NOT EXISTS "planned_transition_qty" numeric(24,8)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "period_ledger_totals" DROP COLUMN IF EXISTS "planned_transition_qty"`,
    );
  }
}
