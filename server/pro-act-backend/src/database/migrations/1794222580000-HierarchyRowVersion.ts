import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = ['organizations', 'tenants'] as const;

/**
 * Optimistic concurrency for organization and plant edits (DECISIONS 2026-10-19, "Organization / plant
 * editing"): `PATCH /v2/organizations/:id` and `PATCH /v2/tenants/:id` take `If-Match: "<row_version>"`
 * and answer 412 on a stale revision. Additive: existing rows start at 1.
 */
export class HierarchyRowVersion1794222580000 implements MigrationInterface {
  name = 'HierarchyRowVersion1794222580000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "row_version" integer NOT NULL DEFAULT 1`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "row_version"`,
      );
    }
  }
}
