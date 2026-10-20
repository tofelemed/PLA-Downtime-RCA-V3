import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DB audit F09 (docs/db-audit/AUDIT_REPORT.md): `pi_af_elements.web_id` carried two identical btree
 * indexes, the unique constraint `UQ_583df9e4a4a26098718f37c8e6f` and the plain `@Index(['webId'])`
 * copy `IDX_583df9e4a4a26098718f37c8e6`. The unique one serves every lookup; the copy only cost writes.
 * `DropV1LegacyTables1794240600000` drops the whole table, so both steps skip when it is absent (on a full
 * revert this `down()` runs before that migration recreates the table).
 * Lock: ACCESS EXCLUSIVE on `pi_af_elements` for the drop (instant).
 */
export class DropPiAfElementDuplicateIndex1794240610000
  implements MigrationInterface
{
  name = 'DropPiAfElementDuplicateIndex1794240610000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner))) return;
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_583df9e4a4a26098718f37c8e6"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner))) return;
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_583df9e4a4a26098718f37c8e6" ON "pi_af_elements" ("web_id") `,
    );
  }
}

async function tableExists(queryRunner: QueryRunner): Promise<boolean> {
  const rows = (await queryRunner.query(
    `SELECT to_regclass('public.pi_af_elements')::text AS "name"`,
  )) as Array<{ name: string | null }>;
  return rows[0]?.name != null;
}
