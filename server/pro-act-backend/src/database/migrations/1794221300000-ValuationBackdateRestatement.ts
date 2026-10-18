import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE = 'accounting_policies';
const CHECK = 'CHK_accounting_policies_restate_approved';

/**
 * Owner, 18 Oct 2026 (DECISIONS "Marun E2E follow-up decisions" → Valuation basis): a backdated valuation
 * policy version over approved figures is accepted only when its author chose the normal revaluation path
 * (each approved period in range gets a change proposal at approval; approved snapshots are never
 * rewritten). The choice is kept on the version so approval can check it again. Expand only: existing
 * versions get false.
 */
export class ValuationBackdateRestatement1794221300000
  implements MigrationInterface
{
  name = 'ValuationBackdateRestatement1794221300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD "restate_approved" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${CHECK}" ` +
        `CHECK (NOT "restate_approved" OR "backdate_reason" IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "${CHECK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP COLUMN "restate_approved"`,
    );
  }
}
