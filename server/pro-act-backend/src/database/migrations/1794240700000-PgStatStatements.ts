import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DB audit F08 (docs/db-audit/AUDIT_REPORT.md): per-statement timing for the database (`pg_stat_statements`
 * view: calls, total / mean time, rows, buffers). The view only collects data where the server loads the
 * library (`shared_preload_libraries = 'pg_stat_statements'`, a restart setting); elsewhere the extension
 * is installed but reading the view raises an error. Ships with the postgres images (contrib).
 * Lock: none on application tables; creates objects in `public`.
 */
export class PgStatStatements1794240700000 implements MigrationInterface {
  name = 'PgStatStatements1794240700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pg_stat_statements"`);
  }
}
