/**
 * Creates the first SuperAdmin when the users table is empty (replaces public SuperAdmin
 * registration, spec WF05 / plan 0.4 part 2).
 *
 *   npm run db:bootstrap-admin -- --email admin@example.com --password 'S3cret!' \
 *       [--name "Site Admin"] [--org-code demo-org --org-name "Demo Org"] \
 *       [--tenant-code demo-plant --tenant-name "Demo Plant"] [--force]
 *
 * --force allows creating an additional SuperAdmin when users already exist.
 */
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../src/database/data-source';

interface Args {
  email: string;
  password: string;
  name: string;
  orgCode: string;
  orgName: string;
  tenantCode: string;
  tenantName: string;
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const email = get('--email');
  const password = get('--password');
  if (!email || !password) {
    throw new Error('--email and --password are required');
  }
  if (password.length < 12) {
    throw new Error('--password must be at least 12 characters');
  }
  return {
    email: email.toLowerCase(),
    password,
    name: get('--name') ?? 'Administrator',
    orgCode: get('--org-code') ?? 'default-org',
    orgName: get('--org-name') ?? 'Default Organization',
    tenantCode: get('--tenant-code') ?? 'default-plant',
    tenantName: get('--tenant-name') ?? 'Default Plant',
    force: argv.includes('--force'),
  };
}

async function ensureByCode(
  table: 'organizations' | 'tenants',
  code: string,
  values: Record<string, unknown>,
): Promise<string> {
  const existing = await AppDataSource.query(
    `SELECT id FROM ${table} WHERE code = $1`,
    [code],
  );
  if (existing.length) {
    return existing[0].id as string;
  }
  const row = { id: randomUUID(), code, ...values };
  const columns = Object.keys(row);
  await AppDataSource.query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
    Object.values(row),
  );
  console.log(`  created ${table} "${code}"`);
  return row.id;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await AppDataSource.initialize();
  try {
    const [{ count }] = await AppDataSource.query(
      'SELECT count(*)::int AS count FROM users',
    );
    if (count > 0 && !args.force) {
      throw new Error(
        `users table already has ${count} row(s); pass --force to add another SuperAdmin`,
      );
    }
    const organizationId = await ensureByCode('organizations', args.orgCode, {
      name: args.orgName,
    });
    const tenantId = await ensureByCode('tenants', args.tenantCode, {
      name: args.tenantName,
      organization_id: organizationId,
    });
    const passwordHash = await bcrypt.hash(
      args.password,
      parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
    );
    const userId = randomUUID();
    await AppDataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO users (id, name, email, password_hash, role, is_active, tenant_id, organization_id)
         VALUES ($1, $2, $3, $4, 'SuperAdmin', true, $5, $6)`,
        [userId, args.name, args.email, passwordHash, tenantId, organizationId],
      );
      await manager.query(
        `INSERT INTO user_scopes (id, tenant_id, user_id, scope_kind, scope_id, role, row_version, created_by, updated_by)
         VALUES ($1, $2, $3, 'tenant', $2, 'SuperAdmin', 1, $3, $3)`,
        [randomUUID(), tenantId, userId],
      );
    });
    console.log(
      `  created SuperAdmin ${args.email} in tenant "${args.tenantCode}"`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(
    'bootstrap-admin failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
