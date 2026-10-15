import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE = 'role_delegations';
const CHECK = 'CHK_role_delegations_role';
const BEFORE = `'manager_approver', 'production_accountant', 'finance_approver', 'quality_approver'`;

/**
 * Owner, 15 Oct 2026 ("standard and common practice"): the metrology / instrumentation approver (scope role
 * added 15 Oct) is delegable like the other approval roles (SME R1 / R6), so an absent metrology owner can
 * hand uncertainty-budget approval to a deputy for a limited time.
 */
export class DelegableMetrologyApprover1794190000000
  implements MigrationInterface
{
  name = 'DelegableMetrologyApprover1794190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "${CHECK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${CHECK}" CHECK ("role" IN (${BEFORE}, 'metrology_approver'))`,
    );
  }

  /** Metrology delegations cannot exist under the old rule; they are removed. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "${TABLE}" WHERE "role" = 'metrology_approver'`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "${CHECK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${CHECK}" CHECK ("role" IN (${BEFORE}))`,
    );
  }
}
