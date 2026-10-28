/**
 * Creates extra accounts from a CSV with random passwords (TF-PREP-001 task 5):
 *
 *   npm run deploy:seed-users -- --csv <file> --tenant-code HDPE-TRAIN --out <passwords file>
 *
 * Existing e-mails are skipped. --out inside a git work tree is refused unless --allow-work-tree. Passwords go to --out (mode 0600, must not exist), never to stdout.
 * Connection from DB_* / DB_SCHEMA as for the backend; the dev database proact is refused.
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { execFileSync } from 'child_process';
import { closeSync, openSync, readFileSync, writeSync } from 'fs';
import { dirname, resolve } from 'path';
import * as bcrypt from 'bcryptjs';
import { EntityManager } from 'typeorm';
import { AppDataSource } from '../../src/database/data-source';
import { parseSeedUsers, SeedUser } from './seed-users/csv';
import { generatePassword } from './seed-users/password';

interface Args {
  csv: string;
  tenantCode: string;
  out: string;
  allowWorkTree: boolean;
}

interface Tenant {
  id: string;
  organizationId: string;
}

const BCRYPT_COST = 10;

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const csv = get('--csv');
  const tenantCode = get('--tenant-code');
  const out = get('--out');
  if (!csv || !tenantCode || !out) {
    throw new Error(
      'usage: deploy:seed-users -- --csv <file> --tenant-code <code> --out <passwords file>',
    );
  }
  return {
    csv: resolve(csv),
    tenantCode,
    out: resolve(out),
    allowWorkTree: argv.includes('--allow-work-tree'),
  };
}

function insideGitWorkTree(dir: string): boolean {
  try {
    const answer = execFileSync(
      'git',
      ['-C', dir, 'rev-parse', '--is-inside-work-tree'],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return answer.toString().trim() === 'true';
  } catch {
    return false;
  }
}

async function findTenant(code: string): Promise<Tenant> {
  const rows: Array<{ id: string; organization_id: string }> =
    await AppDataSource.query(
      'SELECT id, organization_id FROM tenants WHERE code = $1',
      [code],
    );
  if (rows.length === 0) throw new Error(`tenant code ${code} not found`);
  return { id: rows[0].id, organizationId: rows[0].organization_id };
}

async function insertUser(
  manager: EntityManager,
  user: SeedUser,
  tenant: Tenant,
  password: string,
): Promise<void> {
  const userId = randomUUID();
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  await manager.query(
    `INSERT INTO users (id, name, email, password_hash, role, is_active, tenant_id, organization_id)
     VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
    [
      userId,
      user.name,
      user.email,
      hash,
      user.role,
      tenant.id,
      tenant.organizationId,
    ],
  );
  if (!user.scopeRole) return;
  await manager.query(
    `INSERT INTO user_scopes (id, tenant_id, user_id, scope_kind, scope_id, role, row_version, created_by, updated_by)
     VALUES ($1, $2, $3, 'tenant', $2, $4, 1, $3, $3)`,
    [randomUUID(), tenant.id, userId, user.scopeRole],
  );
}

async function userExists(email: string): Promise<boolean> {
  const rows: unknown[] = await AppDataSource.query(
    'SELECT 1 FROM users WHERE lower(email) = $1',
    [email],
  );
  return rows.length > 0;
}

async function createUsers(
  users: SeedUser[],
  tenant: Tenant,
  fd: number,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const user of users) {
    if (await userExists(user.email)) {
      process.stdout.write(`skip ${user.email} exists\n`);
      skipped += 1;
      continue;
    }
    const password = generatePassword();
    await AppDataSource.transaction((manager) =>
      insertUser(manager, user, tenant, password),
    );
    writeSync(fd, `${user.email},${password}\n`);
    created += 1;
  }
  return { created, skipped };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (
    (process.env.DB_NAME ?? 'traverse_forge').trim().toLowerCase() === 'proact'
  ) {
    throw new Error('DB_NAME=proact is the development database; refusing');
  }
  if (!args.allowWorkTree && insideGitWorkTree(dirname(args.out))) {
    throw new Error(
      `refusing to write passwords inside a git work tree: ${dirname(args.out)}; pass --allow-work-tree to override`,
    );
  }
  const users = parseSeedUsers(readFileSync(args.csv, 'utf8'));
  const fd = openSync(args.out, 'wx', 0o600);
  await AppDataSource.initialize();
  try {
    const tenant = await findTenant(args.tenantCode);
    const { created, skipped } = await createUsers(users, tenant, fd);
    process.stdout.write(
      `created ${created}, skipped ${skipped}, passwords in ${args.out}\n`,
    );
  } finally {
    closeSync(fd);
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `seed-users failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
