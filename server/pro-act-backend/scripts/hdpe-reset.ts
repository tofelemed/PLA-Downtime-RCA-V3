/** Explicit, backed-up, local demo reset; never used by product code. */
import { statSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ quiet: true });
const logger = new Logger('HdpeDemoReset');
const keep = new Set([
  'migrations',
  'typeorm_metadata',
  'roles',
  'users',
  'organizations',
  'tenants',
  'feature_flags',
]);
const quote = (identifier: string): string =>
  `"${identifier.replace(/"/g, '""')}"`;

async function assertDemoDatabase(client: Client): Promise<void> {
  const tenants = await client.query<{ code: string }>(
    'SELECT code FROM tenants',
  );
  const known = /^(demo-plant(?:-2)?|partner-plant|E2E-TENANT-.+)$/;
  if (
    !tenants.rows.length ||
    tenants.rows.some((row) => !known.test(row.code))
  ) {
    throw new Error(
      'Refusing reset: tenant inventory is empty or contains an unfamiliar tenant',
    );
  }
  const users = await client.query<{ email: string }>(
    'SELECT email FROM users',
  );
  const demoEmail =
    /^(?:[^@]+@demo\.acme\.com|(?:admin|manager|engineer|operator|e2e-[^@]+)@acme\.com|test@example\.com)$/;
  if (users.rows.some((row) => !demoEmail.test(row.email))) {
    throw new Error('Refusing reset: unfamiliar user; review ownership first');
  }
}

async function reset(client: Client, tables: string[]): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '15s'");
    // No CASCADE: a retained table referencing an operational table must refuse.
    await client.query(
      `TRUNCATE TABLE ${tables.map(quote).join(', ')} RESTART IDENTITY`,
    );
    await client.query(
      "DELETE FROM feature_flags WHERE tenant_id IN (SELECT id FROM tenants WHERE code LIKE 'E2E-TENANT-%')",
    );
    await client.query("DELETE FROM users WHERE email LIKE 'e2e-%@acme.com'");
    await client.query(
      "DELETE FROM users WHERE email ~ '^p-mgr-operator-[0-9a-f]{8}@demo[.]acme[.]com$'",
    );
    await client.query("DELETE FROM tenants WHERE code LIKE 'E2E-TENANT-%'");
    await client.query("DELETE FROM organizations WHERE code LIKE 'E2E-ORG-%'");
    if (process.argv.includes('--hdpe-only')) {
      const target = await client.query<{
        id: string;
        organization_id: string;
      }>("SELECT id, organization_id FROM tenants WHERE code='demo-plant'");
      const plant = target.rows[0];
      if (!plant) throw new Error('HDPE identity is missing');
      await client.query("DELETE FROM users WHERE email='test@example.com'");
      await client.query(
        'UPDATE users SET tenant_id=$1, organization_id=$2, updated_at=now()',
        [plant.id, plant.organization_id],
      );
      await client.query('DELETE FROM feature_flags WHERE tenant_id<>$1', [
        plant.id,
      ]);
      await client.query('DELETE FROM tenants WHERE id<>$1', [plant.id]);
      await client.query('DELETE FROM organizations WHERE id<>$1', [
        plant.organization_id,
      ]);
      await client.query(
        "UPDATE organizations SET name='HDPE', description='Demo: synthetic HDPE petrochemical organization', updated_at=now() WHERE id=$1",
        [plant.organization_id],
      );
    }
    await client.query(
      "UPDATE tenants SET name='HDPE', description='Demo: synthetic petrochemical HDPE finishing plant; unit100 / Extruder1 and unit200 / Extruder2', timezone='Asia/Tehran', calendar_system='gregorian', digits='latin', week_start='saturday' WHERE code='demo-plant'",
    );
    await client.query('COMMIT');
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main(): Promise<void> {
  if (
    !['localhost', '127.0.0.1'].includes(process.env.DB_HOST ?? 'localhost') ||
    (process.env.DB_NAME ?? 'proact') !== 'proact'
  ) {
    throw new Error('Refusing reset outside local proact development DB');
  }
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'proact',
  });
  await client.connect();
  try {
    await assertDemoDatabase(client);
    const result = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN (SELECT c.relname FROM pg_inherits i JOIN pg_class c ON c.oid=i.inhrelid) ORDER BY tablename",
    );
    const tables = result.rows
      .map((row) => row.tablename)
      .filter((name) => !keep.has(name));
    const counts: Record<string, number> = {};
    for (const table of result.rows) {
      const count = await client.query<{ count: string }>(
        `SELECT count(*) FROM ${quote(table.tablename)}`,
      );
      counts[table.tablename] = Number(count.rows[0].count);
    }
    const folder = resolve(__dirname, '../../../test-results/hdpe-audit');
    writeFileSync(
      resolve(folder, 'pre-reset-inventory.json'),
      JSON.stringify({ tables, keep: [...keep], counts }, null, 2),
    );
    logger.log(
      `Inventoried ${result.rows.length} tables; ${tables.length} operational tables selected`,
    );
    if (!process.argv.includes('--apply')) return;
    const backup = resolve(folder, 'pre-reset-proact.dump');
    if (statSync(backup).size < 1024)
      throw new Error('A nonempty pg_dump backup is required');
    await reset(client, tables);
    logger.log(
      'Committed demo reset; schema, migrations, demo identities and feature flags preserved',
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
