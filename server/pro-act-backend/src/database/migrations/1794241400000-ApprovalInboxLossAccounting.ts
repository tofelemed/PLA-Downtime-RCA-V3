import { MigrationInterface, QueryRunner } from 'typeorm';

const INDEX = 'IDX_approval_inbox_accounting_policies';

async function recreate(
  queryRunner: QueryRunner,
  kinds: string,
): Promise<void> {
  await queryRunner.query(`DROP INDEX IF EXISTS "public"."${INDEX}"`);
  await queryRunner.query(
    `CREATE INDEX "${INDEX}" ON "accounting_policies" (tenant_id, created_at, id) WHERE approved_at IS NULL AND policy_kind IN (${kinds})`,
  );
}

/**
 * The approval inbox lists `loss_accounting` drafts next to `valuation_basis` and `source_authority` ones, so the
 * pending-draft partial index covers the kind too (a query reaches a partial index only when its predicate implies the index's).
 */
export class ApprovalInboxLossAccounting1794241400000
  implements MigrationInterface
{
  name = 'ApprovalInboxLossAccounting1794241400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await recreate(
      queryRunner,
      `'valuation_basis','source_authority','loss_accounting'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await recreate(queryRunner, `'valuation_basis','source_authority'`);
  }
}
