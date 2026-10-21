import { EntityManager } from 'typeorm';
import { enqueueOutbox } from '../common/outbox/outbox-writer';

/**
 * A plant's settings or identity changed (name, time zone, calendar, digits, week start). The browser has
 * no resource family for `plant_settings`, so every open screen of the plant refetches: week buckets,
 * operational dates and labels all depend on these settings (settings audit, 21 Oct 2026).
 */
export function announcePlantSettings(
  manager: EntityManager,
  tenantId: string,
): Promise<string[]> {
  return enqueueOutbox(manager, [
    {
      tenantId,
      aggregateType: 'plant_settings',
      aggregateId: tenantId,
      type: 'PlantSettingsChanged',
      payload: { tenantId },
    },
  ]);
}

/**
 * The app-wide branding changed: one `admin_config` notice per plant, so every signed-in user's shell
 * refetches the name, logo and colours without a reload. Called outside the caller's tenant binding.
 */
export async function announceBranding(manager: EntityManager): Promise<void> {
  const plants = await manager.query<Array<{ id: string }>>(
    `SELECT "id"::text AS "id" FROM "tenants"`,
  );
  await enqueueOutbox(
    manager,
    plants.map(({ id }) => ({
      tenantId: id,
      aggregateType: 'admin_config',
      aggregateId: id,
      type: 'BrandingChanged',
      payload: { tenantId: id },
    })),
  );
}
