import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Owner decision 2026-10-12 "Plant admin should see the users": a deliberate, narrow exception to the
 * `tenant_isolation` row-level-security policy on `users`, so a plant administrator sees, names and manages
 * the access of users whose home plant is another plant but who hold a `user_scopes` grant in its plant.
 *
 * Two public entry points, both SECURITY DEFINER (owner = the migration role), `search_path` pinned to
 * `pg_catalog, public`, EXECUTE revoked from PUBLIC and granted only to `proact_rls_user` (the role the API
 * switches to for a signed-in non-SuperAdmin request; the login role owns them):
 *
 * - `app_plant_user_directory(p_tenant_id uuid, p_user_ids uuid[] DEFAULT NULL)`: the users who are home
 *   members of the plant or hold a scope grant there (optionally only the given ids).
 * - `app_organization_user_by_email(p_tenant_id uuid, p_email text)`: the user with exactly this e-mail
 *   (case-insensitive) in the plant's organization (`users.organization_id`, else its home plant's), for a
 *   first grant into the plant. No fuzzy search.
 *
 * Both return only directory columns (id, name, email, role, is_active, home tenant_id, organization_id,
 * created_at, updated_at): never the password hash or anything else. Both refuse (SQLSTATE 42501) a tenant
 * that the session is not bound to: the tenant must be one of `app_rls_tenant_ids()` — the same setting
 * the RLS policies read — unless that setting is unrestricted (SuperAdmin, workers, binding off), exactly
 * when the policies restrict nothing either. The API passes only the acting tenant of the request context.
 *
 * The reads themselves live in two private helpers (`app_plant_user_rows`, `app_organization_user_rows`,
 * EXECUTE granted to nobody) that run with `app.tenant_ids` set to '' for their duration, so they also work
 * when the owner is not a superuser (FORCE ROW LEVEL SECURITY applies to table owners).
 */
const RLS_ROLE = 'proact_rls_user';

const COLUMNS = `id uuid, name varchar, email varchar, role varchar, is_active boolean, tenant_id uuid,
  organization_id uuid, created_at timestamptz, updated_at timestamptz`;
const SELECT_USER = `u.id, u.name, u.email, u.role, u.is_active, u.tenant_id, u.organization_id,
  u.created_at, u.updated_at`;
const DEFINER = `STABLE SECURITY DEFINER SET search_path = pg_catalog, public`;

/** The caller's tenant must be bound to the session (same rule as the `tenant_isolation` policy). */
const TENANT_CHECK = `IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'a tenant is required' USING ERRCODE = '42501';
  END IF;
  IF public.app_rls_tenant_ids() IS NOT NULL
     AND NOT (p_tenant_id::text = ANY (public.app_rls_tenant_ids())) THEN
    RAISE EXCEPTION 'tenant % is not bound to this session', p_tenant_id USING ERRCODE = '42501';
  END IF;`;

const PLANT_ROWS = `CREATE FUNCTION app_plant_user_rows(p_tenant_id uuid, p_user_ids uuid[])
RETURNS TABLE (${COLUMNS}) LANGUAGE sql ${DEFINER} SET app.tenant_ids = '' AS $$
  SELECT ${SELECT_USER}
    FROM public.users u
   WHERE u.id IN (SELECT m.id FROM public.users m WHERE m.tenant_id = p_tenant_id
                  UNION
                  SELECT s.user_id FROM public.user_scopes s WHERE s.tenant_id = p_tenant_id)
     AND (p_user_ids IS NULL OR u.id = ANY (p_user_ids))
$$`;

const ORGANIZATION_ROWS = `CREATE FUNCTION app_organization_user_rows(p_tenant_id uuid, p_email text)
RETURNS TABLE (${COLUMNS}) LANGUAGE sql ${DEFINER} SET app.tenant_ids = '' AS $$
  SELECT ${SELECT_USER}
    FROM public.users u
    JOIN public.tenants plant ON plant.id = p_tenant_id AND plant.organization_id IS NOT NULL
    LEFT JOIN public.tenants home ON home.id = u.tenant_id
   WHERE lower(u.email) = lower(btrim(p_email))
     AND COALESCE(u.organization_id, home.organization_id) = plant.organization_id
$$`;

const PLANT_DIRECTORY = `CREATE FUNCTION app_plant_user_directory(p_tenant_id uuid, p_user_ids uuid[] DEFAULT NULL)
RETURNS TABLE (${COLUMNS}) LANGUAGE plpgsql ${DEFINER} AS $$
BEGIN
  ${TENANT_CHECK}
  RETURN QUERY SELECT * FROM public.app_plant_user_rows(p_tenant_id, p_user_ids);
END
$$`;

const ORGANIZATION_LOOKUP = `CREATE FUNCTION app_organization_user_by_email(p_tenant_id uuid, p_email text)
RETURNS TABLE (${COLUMNS}) LANGUAGE plpgsql ${DEFINER} AS $$
BEGIN
  ${TENANT_CHECK}
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.app_organization_user_rows(p_tenant_id, p_email);
END
$$`;

const SIGNATURES = {
  plantRows: 'app_plant_user_rows(uuid, uuid[])',
  organizationRows: 'app_organization_user_rows(uuid, text)',
  directory: 'app_plant_user_directory(uuid, uuid[])',
  lookup: 'app_organization_user_by_email(uuid, text)',
};

export class PlantUserDirectory1793905000000 implements MigrationInterface {
  name = 'PlantUserDirectory1793905000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of [
      PLANT_ROWS,
      ORGANIZATION_ROWS,
      PLANT_DIRECTORY,
      ORGANIZATION_LOOKUP,
    ]) {
      await queryRunner.query(sql);
    }
    for (const signature of Object.values(SIGNATURES)) {
      await queryRunner.query(
        `REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC`,
      );
    }
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION ${SIGNATURES.directory} TO ${RLS_ROLE}`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION ${SIGNATURES.lookup} TO ${RLS_ROLE}`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_email_lower" ON "users" (lower("email"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_users_email_lower"`);
    await queryRunner.query(`DROP FUNCTION ${SIGNATURES.lookup}`);
    await queryRunner.query(`DROP FUNCTION ${SIGNATURES.directory}`);
    await queryRunner.query(`DROP FUNCTION ${SIGNATURES.organizationRows}`);
    await queryRunner.query(`DROP FUNCTION ${SIGNATURES.plantRows}`);
  }
}
