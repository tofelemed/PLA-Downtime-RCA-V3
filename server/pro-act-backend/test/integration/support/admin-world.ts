import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { mapLegacyRole } from '../../../src/auth/roles/role-model';
import { signToken } from './test-app';

/** Two organizations: Org 1 with plants A and B, Org 2 with plant C; one unit in A. */
export interface AdminWorld {
  org1: string;
  org2: string;
  plantA: string;
  plantB: string;
  plantC: string;
  unitA: string;
}

export async function seedAdminWorld(
  dataSource: DataSource,
): Promise<AdminWorld> {
  const suffix = randomUUID().slice(0, 8);
  const world: AdminWorld = {
    org1: randomUUID(),
    org2: randomUUID(),
    plantA: randomUUID(),
    plantB: randomUUID(),
    plantC: randomUUID(),
    unitA: randomUUID(),
  };
  await dataSource.query(
    `INSERT INTO organizations (id, code, name, is_active) VALUES ($1, $2, 'Org One', true), ($3, $4, 'Org Two', true)`,
    [world.org1, `O1-${suffix}`, world.org2, `O2-${suffix}`],
  );
  await dataSource.query(
    `INSERT INTO tenants (id, code, name, organization_id, is_active) VALUES
       ($1, $2, 'Plant A', $3, true), ($4, $5, 'Plant B', $3, true), ($6, $7, 'Plant C', $8, true)`,
    [
      world.plantA,
      `PA-${suffix}`,
      world.org1,
      world.plantB,
      `PB-${suffix}`,
      world.plantC,
      `PC-${suffix}`,
      world.org2,
    ],
  );
  await dataSource.query(
    `INSERT INTO units (id, code, name, tenant_id, organization_id) VALUES ($1, $2, 'Line A1', $3, $4)`,
    [world.unitA, `U-${suffix}`, world.plantA, world.org1],
  );
  return world;
}

export interface SeededUser {
  id: string;
  token: string;
}

export interface UserSeed {
  name: string;
  role: string;
  tenantId?: string | null;
  organizationId: string;
  isActive?: boolean;
  /** extra scope grants: role in a plant */
  scopes?: Array<{ tenantId: string; role: string }>;
}

/** Inserts a user (with its home-plant scope, as registration writes it) and signs a token acting in its plant. */
export async function seedUser(
  app: INestApplication,
  dataSource: DataSource,
  seed: UserSeed,
): Promise<SeededUser> {
  const id = randomUUID();
  await dataSource.query(
    `INSERT INTO users (id, name, email, password_hash, role, tenant_id, organization_id, is_active)
     VALUES ($1, $2, $3, 'x', $4, $5, $6, $7)`,
    [
      id,
      seed.name,
      `${id}@test.local`,
      seed.role,
      seed.tenantId ?? null,
      seed.organizationId,
      seed.isActive ?? true,
    ],
  );
  const grants = [
    ...(seed.tenantId
      ? [{ tenantId: seed.tenantId, role: mapLegacyRole(seed.role) }]
      : []),
    ...(seed.scopes ?? []),
  ];
  for (const grant of grants) {
    await dataSource.query(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'tenant', $1, $3, 1)`,
      [grant.tenantId, id, grant.role],
    );
  }
  const token = signToken(app, {
    userId: id,
    tenantId: seed.tenantId ?? undefined,
    organizationId: seed.organizationId,
    role: seed.role,
  });
  return { id, token };
}

/** Token of an existing user acting in another plant (`X-Tenant-Id` is the other way to select it). */
export function tokenIn(
  app: INestApplication,
  user: { id: string; role: string; organizationId: string },
  tenantId: string,
): string {
  return signToken(app, {
    userId: user.id,
    tenantId,
    organizationId: user.organizationId,
    role: user.role,
  });
}

/** A response body of these suites (supertest types bodies as `any`). */
export interface ApiBody {
  code: string;
  id: string;
  [field: string]: unknown;
}

/** The JSON body of a supertest response, typed for the assertion at hand. */
export function bodyOf<T = ApiBody>(response: { body: unknown }): T {
  return response.body as T;
}
