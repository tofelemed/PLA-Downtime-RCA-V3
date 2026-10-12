import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RCA cause library tree (API usage audit, defects 1 and 11): `rca_cause_codes.parent_id` so the tree
 * editor can add child causes and re-parent them. Nullable (existing rows stay roots), indexed (FK and
 * the children lookup), and `ON DELETE CASCADE` because deleting a cause deletes its subtree.
 */
export class RcaCauseCodeParent1793900060000 implements MigrationInterface {
  name = 'RcaCauseCodeParent1793900060000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rca_cause_codes" ADD "parent_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0d6fc1a3c3a0e83b3fce15fb9c" ON "rca_cause_codes" ("parent_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_cause_codes" ADD CONSTRAINT "FK_0d6fc1a3c3a0e83b3fce15fb9c5" FOREIGN KEY ("parent_id") REFERENCES "rca_cause_codes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rca_cause_codes" DROP CONSTRAINT "FK_0d6fc1a3c3a0e83b3fce15fb9c5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0d6fc1a3c3a0e83b3fce15fb9c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_cause_codes" DROP COLUMN "parent_id"`,
    );
  }
}
