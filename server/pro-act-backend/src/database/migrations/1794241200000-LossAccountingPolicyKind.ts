import { MigrationInterface, QueryRunner } from 'typeorm';
import { dropPolicyKind } from '../policy-kind-enum';

/**
 * Declared mode: the policy kind `loss_accounting` (basis, grain and tolerance of the plant's loss accounting).
 * The enum value is added here on its own; the next migration seeds the per-tenant default, because a new
 * enum value cannot be used in the transaction that adds it. `down` deletes the kind's versions and rebuilds
 * the type without the value.
 */
export class LossAccountingPolicyKind1794241200000
  implements MigrationInterface
{
  name = 'LossAccountingPolicyKind1794241200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."accounting_policy_kind" ADD VALUE IF NOT EXISTS 'loss_accounting'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await dropPolicyKind(queryRunner, 'loss_accounting');
  }
}
