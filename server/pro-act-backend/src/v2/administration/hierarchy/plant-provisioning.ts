import { EntityManager } from 'typeorm';
import { ensureDefaultSite } from '../../../calendar/default-site';
import { RequestContext } from '../../../common/context/request-context';
import { Tenant } from '../../../tenant/tenant.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs inside the plant-creation transaction: the plant's default site (named after the plant, in its time
 * zone, operational day from 06:00 like the on-first-use path). No role is granted: an organization
 * administrator reaches every plant of its organization (`maySelectTenant`, DECISIONS 2026-10-22).
 */
export async function provisionPlant(
  manager: EntityManager,
  plant: Tenant,
  creator: RequestContext,
): Promise<void> {
  await ensureDefaultSite(manager, plant, uuidOrNull(creator.userId));
}

function uuidOrNull(value: string | null): string | null {
  return value && UUID.test(value) ? value : null;
}
