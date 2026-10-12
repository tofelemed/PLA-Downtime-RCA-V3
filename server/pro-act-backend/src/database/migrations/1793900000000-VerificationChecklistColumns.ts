import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Verification checklists (API usage audit, defects 2 and 6): the RCA settings form saves a badge
 * `color` and the ordered checklist `items`, which `verification_status_codes` never stored (create
 * answered 400, update 500). Additive: `color` is nullable, `items` defaults to an empty list.
 */
export class VerificationChecklistColumns1793900000000
  implements MigrationInterface
{
  name = 'VerificationChecklistColumns1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "verification_status_codes" ADD "color" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "verification_status_codes" ADD "items" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "verification_status_codes" DROP COLUMN "items"`,
    );
    await queryRunner.query(
      `ALTER TABLE "verification_status_codes" DROP COLUMN "color"`,
    );
  }
}
