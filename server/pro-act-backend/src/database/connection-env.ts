/**
 * Connection settings read from the environment that go beyond host/port/name (TF-PREP-001 §4.2):
 * the login role, the application schema and TLS. Shared by the app, the worker and the migration CLI.
 */

const SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

/** `DB_USER` (deployment name) wins over the older `DB_USERNAME`; `postgres` for local development. */
export function dbUser(env: NodeJS.ProcessEnv = process.env): string {
  return env.DB_USER || env.DB_USERNAME || 'postgres';
}

/**
 * `DB_SCHEMA` sets the session `search_path` (production: `forge`); unset keeps the server's default,
 * which is `public` on the development database. SQL stays unqualified, so nothing else changes.
 */
export function dbSchema(env: NodeJS.ProcessEnv = process.env): string | null {
  const schema = env.DB_SCHEMA?.trim();
  if (!schema) return null;
  if (!SCHEMA_NAME.test(schema)) {
    throw new Error(
      `DB_SCHEMA must be a lowercase identifier, got "${schema}"`,
    );
  }
  return schema;
}

/** pg pool options carrying the schema (`-c search_path=…`); empty when `DB_SCHEMA` is unset. */
export function schemaPoolOptions(env: NodeJS.ProcessEnv = process.env): {
  options?: string;
} {
  const schema = dbSchema(env);
  return schema ? { options: `-c search_path=${schema}` } : {};
}

/**
 * `DB_SSL`: unset/`false` = plain, `true` = TLS with certificate check. A server certificate from a
 * private CA is trusted through Node's `NODE_EXTRA_CA_CERTS`, never by switching the check off.
 */
export function dbSsl(
  env: NodeJS.ProcessEnv = process.env,
): false | { rejectUnauthorized: true } {
  const mode = (env.DB_SSL || 'false').trim().toLowerCase();
  if (mode === 'false') return false;
  if (mode === 'true') return { rejectUnauthorized: true };
  throw new Error(`DB_SSL must be true or false, got "${mode}"`);
}

/**
 * `DB_MIGRATIONS_DIR` redirects the migrations glob to another folder (the baseline exporter copies a subset
 * of migration files there). Returned with forward slashes and no trailing slash, as TypeORM globs need.
 */
export function dbMigrationsDir(
  env: NodeJS.ProcessEnv,
  fallback: string,
): string {
  const dir = env.DB_MIGRATIONS_DIR?.trim();
  if (!dir) return fallback;
  return dir.replace(/\\/g, '/').replace(/\/+$/, '');
}
