import { MigrationInterface, QueryRunner } from 'typeorm';

const INDEX = 'IDX_approval_inbox_accounting_policies';

async function recreate(
  queryRunner: QueryRunner,
  predicate: string,
): Promise<void> {
  await queryRunner.query(`DROP INDEX IF EXISTS "public"."${INDEX}"`);
  await queryRunner.query(
    `CREATE INDEX "${INDEX}" ON "accounting_policies" (tenant_id, created_at, id) WHERE ${predicate}`,
  );
}

/**
 * The approval inbox lists `loss_accounting` drafts next to `valuation_basis` and `source_authority` ones. The
 * pending-draft partial index drops its kind list: a predicate naming `loss_accounting` fails when this runs in
 * the transaction that added the enum value ("unsafe use of new value"), and every inbox query filters the kind
 * itself, so `approved_at IS NULL` (implied by each of them) keeps the index usable.
 */
export class ApprovalInboxLossAccounting1794241400000
  implements MigrationInterface
{
  name = 'ApprovalInboxLossAccounting1794241400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await recreate(queryRunner, 'approved_at IS NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await recreate(
      queryRunner,
      `approved_at IS NULL AND policy_kind IN ('valuation_basis','source_authority')`,
    );
  }
}
