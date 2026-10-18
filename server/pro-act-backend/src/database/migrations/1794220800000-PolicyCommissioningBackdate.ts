import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE = 'accounting_policies';
const CHECK = 'CHK_accounting_policies_backdate';

/**
 * Owner, 18 Oct 2026 (DECISIONS "Marun HDPE training plant", commissioning backdate): a policy version
 * that otherwise takes effect at approval / record time may be given an effective-from in the past while
 * no calculated period of its scope overlaps that range. The requested instant and the reason are kept
 * on the version (a source authority draft carries them until approval). Expand only: nullable, existing
 * versions stay null.
 */
export class PolicyCommissioningBackdate1794220800000
  implements MigrationInterface
{
  name = 'PolicyCommissioningBackdate1794220800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD "requested_effective_from" TIMESTAMP WITH TIME ZONE, ADD "backdate_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${CHECK}" ` +
        `CHECK (("requested_effective_from" IS NULL) = ("backdate_reason" IS NULL))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "${CHECK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" DROP COLUMN "backdate_reason", DROP COLUMN "requested_effective_from"`,
    );
  }
}
