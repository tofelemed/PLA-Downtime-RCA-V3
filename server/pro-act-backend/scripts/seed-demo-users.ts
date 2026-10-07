/**
 * Seeds the demo accounts shown on the login page (src/components/LoginForm.tsx)
 * into the Postgres database, attached to the "Demo Org" / "Demo Plant" hierarchy.
 *
 * Idempotent: re-running resets each demo user's password, role and plant.
 *
 * Run with: npm run db:seed-demo-users
 */
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const DEMO_USERS = [
  { email: 'admin@acme.com', password: 'demo123', name: 'Acme Admin', role: 'SuperAdmin' },
  { email: 'test@example.com', password: 'Test123!@#', name: 'Test SuperAdmin', role: 'SuperAdmin' },
  { email: 'manager@acme.com', password: 'demo123', name: 'Acme Plant Manager', role: 'TenantAdmin' },
  { email: 'engineer@acme.com', password: 'demo123', name: 'Acme Engineer', role: 'Engineer' },
  { email: 'operator@acme.com', password: 'demo123', name: 'Acme Operator', role: 'Operator' },
];

async function ensureRow(client: Client, table: string, code: string, values: Record<string, unknown>): Promise<string> {
  const existing = await client.query(`SELECT id FROM ${table} WHERE code = $1`, [code]);
  if (existing.rows.length) return existing.rows[0].id;

  const row = { id: randomUUID(), code, ...values };
  const cols = Object.keys(row);
  await client.query(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
    Object.values(row),
  );
  console.log(`  created ${table} "${code}"`);
  return row.id;
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'proact',
  });
  await client.connect();

  try {
    const organizationId = await ensureRow(client, 'organizations', 'demo-org', { name: 'Demo Org' });
    const tenantId = await ensureRow(client, 'tenants', 'demo-plant', {
      name: 'Demo Plant',
      organization_id: organizationId,
    });

    for (const user of DEMO_USERS) {
      const passwordHash = await bcrypt.hash(user.password, parseInt(process.env.BCRYPT_ROUNDS || '10', 10));
      const result = await client.query(
        `INSERT INTO users (id, name, email, password_hash, role, is_active, tenant_id, organization_id)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
           is_active = true, tenant_id = EXCLUDED.tenant_id, organization_id = EXCLUDED.organization_id,
           updated_at = now()
         RETURNING (xmax = 0) AS inserted`,
        [randomUUID(), user.name, user.email.toLowerCase(), passwordHash, user.role, tenantId, organizationId],
      );
      console.log(`  ${result.rows[0].inserted ? 'created' : 'updated'} ${user.email} (${user.role})`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Seeding demo users failed:', err);
  process.exit(1);
});
