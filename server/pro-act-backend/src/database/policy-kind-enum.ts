import { QueryRunner } from 'typeorm';

/**
 * Removes one value of `accounting_policy_kind` in a migration's `down` (Postgres cannot drop an enum
 * value): the kind's policy versions are deleted, then the type is rebuilt from the values that remain, in
 * their order. `up` adds a value with `ADD VALUE IF NOT EXISTS`, which commutes with other migrations that
 * add kinds.
 */
export async function dropPolicyKind(
  queryRunner: QueryRunner,
  kind: string,
): Promise<void> {
  await queryRunner.query(
    `DELETE FROM "accounting_policies" WHERE "policy_kind"::text = $1`,
    [kind],
  );
  const rows = (await queryRunner.query(
    `SELECT e.enumlabel AS "value" FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'accounting_policy_kind' AND e.enumlabel <> $1 ORDER BY e.enumsortorder`,
    [kind],
  )) as Array<{ value: string }>;
  const values = rows.map((r) => `'${r.value}'`).join(', ');
  await queryRunner.query(
    `DROP INDEX "public"."IDX_accounting_policies_lookup"`,
  );
  await queryRunner.query(
    `ALTER TABLE "accounting_policies" DROP CONSTRAINT "UQ_accounting_policies_kind_scope_version"`,
  );
  await queryRunner.query(
    `ALTER TYPE "public"."accounting_policy_kind" RENAME TO "accounting_policy_kind_old"`,
  );
  await queryRunner.query(
    `CREATE TYPE "public"."accounting_policy_kind" AS ENUM(${values})`,
  );
  await queryRunner.query(
    `ALTER TABLE "accounting_policies" ALTER COLUMN "policy_kind" TYPE "public"."accounting_policy_kind" ` +
      `USING "policy_kind"::"text"::"public"."accounting_policy_kind"`,
  );
  await queryRunner.query(`DROP TYPE "public"."accounting_policy_kind_old"`);
  await queryRunner.query(
    `CREATE INDEX "IDX_accounting_policies_lookup" ON "accounting_policies" ("tenant_id", "policy_kind", "unit_id", "effective_from")`,
  );
  await queryRunner.query(
    `ALTER TABLE "accounting_policies" ADD CONSTRAINT "UQ_accounting_policies_kind_scope_version" UNIQUE ("tenant_id", "policy_kind", "scope_key", "version")`,
  );
}
