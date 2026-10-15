import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';

/**
 * Inserts an organisation and a plant (tenant) with the given id: every v1 `tenant_id` references
 * `tenants` since DB-05, so a spec that writes rows for a made-up tenant id seeds it first.
 */
export async function seedPlant(
  dataSource: DataSource,
  tenantId: string,
): Promise<void> {
  const organizationId = randomUUID();
  await dataSource.query(
    `INSERT INTO organizations (id, code, name, is_active) VALUES ($1, $2, 'Org', true)`,
    [organizationId, `ORG-${organizationId.slice(0, 8)}`],
  );
  await dataSource.query(
    `INSERT INTO tenants (id, code, name, organization_id, is_active) VALUES ($1, $2, $2, $3, true)`,
    [tenantId, `TEN-${tenantId.slice(0, 8)}`, organizationId],
  );
}
