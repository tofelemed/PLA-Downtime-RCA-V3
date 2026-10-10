import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan 3.11 step 2 (NFR01 "DB tenant isolation", T14): Postgres row-level security on every table with a
 * `tenant_id` column (v1 varchar and v2 uuid alike; partitions inherit their parent's policy).
 *
 * Policy `tenant_isolation` (all commands, USING and WITH CHECK):
 *   app_rls_tenant_ids() IS NULL OR tenant_id IS NULL OR tenant_id::text = ANY (app_rls_tenant_ids())
 * `app_rls_tenant_ids()` reads the session setting `app.tenant_ids` (comma-separated tenant uuids); unset
 * or '' means no restriction. Rows without a tenant stay visible (v1 global rows).
 *
 * Postgres never applies RLS to superusers or `BYPASSRLS` roles. The role `proact_rls_user` (NOLOGIN,
 * NOBYPASSRLS, DML on every table) is what the API switches to for a signed-in, non-SuperAdmin request
 * (`TenantSessionBinding`, `DB_RLS_TENANT_BINDING=true`): `SET ROLE proact_rls_user` plus the caller's
 * tenants on every connection checkout, `RESET ROLE` otherwise. The login role therefore needs no change
 * (a superuser may always switch; another login role must be granted `proact_rls_user`). The two
 * partition helpers become SECURITY DEFINER so a request may still create a month partition.
 *
 * `organizations` is excluded (an organization spans tenants). New tenant tables must add the same
 * policy in their migration; `tenant-rls.int-spec.ts` fails otherwise. `down()` drops the policies,
 * grants and function; the role itself is dropped only when no other database still uses it.
 */
const RLS_ROLE = 'proact_rls_user';
const EXCLUDED_TABLES = ['organizations'];
const PARTITION_FUNCTIONS = [
  '"raw_observations_ensure_partition"(timestamptz)',
  '"measurement_samples_ensure_partition"(timestamptz)',
];

const FUNCTION_UP = `CREATE FUNCTION app_rls_tenant_ids() RETURNS text[] LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN COALESCE(current_setting('app.tenant_ids', true), '') = '' THEN NULL
              ELSE string_to_array(current_setting('app.tenant_ids', true), ',') END
$$`;

const ROLE_UP = `DO $$ BEGIN
  CREATE ROLE ${RLS_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`;

const ROLE_DOWN = `DO $$ BEGIN
  DROP ROLE ${RLS_ROLE};
EXCEPTION WHEN dependent_objects_still_exist OR undefined_object THEN NULL;
END $$`;

const GRANTS_UP: readonly string[] = [
  `GRANT USAGE ON SCHEMA public TO ${RLS_ROLE}`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${RLS_ROLE}`,
  `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${RLS_ROLE}`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${RLS_ROLE}`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${RLS_ROLE}`,
  ...PARTITION_FUNCTIONS.map(
    (fn) =>
      `ALTER FUNCTION ${fn} SECURITY DEFINER SET search_path = public, pg_temp`,
  ),
];

const GRANTS_DOWN: readonly string[] = [
  ...PARTITION_FUNCTIONS.map(
    (fn) => `ALTER FUNCTION ${fn} SECURITY INVOKER RESET search_path`,
  ),
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM ${RLS_ROLE}`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM ${RLS_ROLE}`,
  `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${RLS_ROLE}`,
  `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${RLS_ROLE}`,
  `REVOKE USAGE ON SCHEMA public FROM ${RLS_ROLE}`,
];

/** Tables (and partitioned parents) of the public schema that carry `tenant_id`. */
const TENANT_TABLES_SQL = `SELECT c.relname AS "table"
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
 WHERE c.relkind IN ('r', 'p') AND NOT c.relispartition AND c.relname <> ALL ($1)
 ORDER BY c.relname`;

const POLICY_EXPRESSION = `app_rls_tenant_ids() IS NULL OR tenant_id IS NULL OR tenant_id::text = ANY (app_rls_tenant_ids())`;

export class TenantRowLevelSecurity1793484800000 implements MigrationInterface {
  name = 'TenantRowLevelSecurity1793484800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(FUNCTION_UP);
    const tables = (await queryRunner.query(TENANT_TABLES_SQL, [
      EXCLUDED_TABLES,
    ])) as Array<{ table: string }>;
    for (const { table } of tables) {
      await queryRunner.query(
        `CREATE POLICY tenant_isolation ON "${table}" USING (${POLICY_EXPRESSION}) WITH CHECK (${POLICY_EXPRESSION})`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
      );
    }
    await queryRunner.query(ROLE_UP);
    for (const sql of GRANTS_UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of GRANTS_DOWN) await queryRunner.query(sql);
    await queryRunner.query(ROLE_DOWN);
    const rows = (await queryRunner.query(
      `SELECT tablename AS "table" FROM pg_policies WHERE schemaname = 'public' AND policyname = 'tenant_isolation'`,
    )) as Array<{ table: string }>;
    for (const { table } of rows) {
      await queryRunner.query(`DROP POLICY tenant_isolation ON "${table}"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`,
      );
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS app_rls_tenant_ids()`);
  }
}
