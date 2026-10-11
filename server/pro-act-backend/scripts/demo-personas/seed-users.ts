/**
 * Upserts the persona users (same statement as scripts/seed-demo-users.ts) and makes their
 * `user_scopes` rows match the catalogue exactly: missing rows are inserted, rows the catalogue does
 * not list are removed, so a re-run always converges on the documented state.
 */
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { DemoWorld, unitKey } from './demo-world';
import {
  DEMO_PERSONA_PASSWORD,
  Persona,
  PersonaScope,
  PersonaUser,
} from './persona-catalog';

export interface UsersSummary {
  usersCreated: number;
  usersUpdated: number;
  scopesCreated: number;
  scopesKept: number;
  scopesRemoved: number;
}

interface ScopeRow {
  tenantId: string;
  kind: PersonaScope['kind'];
  scopeId: string;
  role: string;
}

function scopeRowKey(row: ScopeRow): string {
  return `${row.kind}:${row.scopeId}:${row.role}`;
}

function resolveScope(world: DemoWorld, scope: PersonaScope): ScopeRow {
  const tenantId = world.plants[scope.plant].id;
  if (scope.kind === 'tenant') {
    return { tenantId, kind: 'tenant', scopeId: tenantId, role: scope.role };
  }
  const unitId =
    scope.unitCode && world.units.get(unitKey(scope.plant, scope.unitCode));
  if (!unitId) {
    throw new Error(
      `unit scope needs a seeded unit code, got "${scope.unitCode ?? ''}"`,
    );
  }
  return { tenantId, kind: 'unit', scopeId: unitId, role: scope.role };
}

async function upsertUser(
  client: Client,
  world: DemoWorld,
  user: PersonaUser,
  passwordHash: string,
): Promise<{ id: string; inserted: boolean }> {
  const plant = world.plants[user.homePlant];
  const result = await client.query<{ id: string; inserted: boolean }>(
    `INSERT INTO users (id, name, email, password_hash, role, is_active, tenant_id, organization_id)
     VALUES ($1, $2, $3, $4, $5, true, $6, $7)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
       is_active = true, tenant_id = EXCLUDED.tenant_id, organization_id = EXCLUDED.organization_id,
       updated_at = now()
     RETURNING id, (xmax = 0) AS inserted`,
    [
      randomUUID(),
      user.name,
      user.email.toLowerCase(),
      passwordHash,
      user.legacyRole,
      plant.id,
      plant.organizationId,
    ],
  );
  return result.rows[0];
}

/** Deletes scope rows the catalogue does not list and inserts the missing ones. */
async function syncScopes(
  client: Client,
  userId: string,
  desired: ScopeRow[],
  summary: UsersSummary,
): Promise<void> {
  const existing = await client.query<{
    id: string;
    scope_kind: ScopeRow['kind'];
    scope_id: string;
    role: string;
  }>(
    `SELECT id, scope_kind, scope_id, role FROM user_scopes WHERE user_id = $1`,
    [userId],
  );
  const wanted = new Map(desired.map((row) => [scopeRowKey(row), row]));
  const present = new Set<string>();
  for (const row of existing.rows) {
    const key = scopeRowKey({
      tenantId: '',
      kind: row.scope_kind,
      scopeId: row.scope_id,
      role: row.role,
    });
    if (wanted.has(key)) {
      present.add(key);
      summary.scopesKept += 1;
      continue;
    }
    await client.query(`DELETE FROM user_scopes WHERE id = $1`, [row.id]);
    summary.scopesRemoved += 1;
  }
  for (const [key, row] of wanted) {
    if (present.has(key)) continue;
    await client.query(
      `INSERT INTO user_scopes (id, tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, $3, $4, $5, $6, 1)
       ON CONFLICT ON CONSTRAINT "UQ_user_scopes_user_scope_role" DO NOTHING`,
      [randomUUID(), row.tenantId, userId, row.kind, row.scopeId, row.role],
    );
    summary.scopesCreated += 1;
  }
}

export async function seedPersonaUsers(
  client: Client,
  world: DemoWorld,
  personas: readonly Persona[],
): Promise<UsersSummary> {
  const summary: UsersSummary = {
    usersCreated: 0,
    usersUpdated: 0,
    scopesCreated: 0,
    scopesKept: 0,
    scopesRemoved: 0,
  };
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
  const passwordHash = await bcrypt.hash(DEMO_PERSONA_PASSWORD, rounds);
  for (const persona of personas) {
    for (const user of persona.users) {
      const { id, inserted } = await upsertUser(
        client,
        world,
        user,
        passwordHash,
      );
      if (inserted) summary.usersCreated += 1;
      else summary.usersUpdated += 1;
      await syncScopes(
        client,
        id,
        user.scopes.map((scope) => resolveScope(world, scope)),
        summary,
      );
    }
  }
  return summary;
}
