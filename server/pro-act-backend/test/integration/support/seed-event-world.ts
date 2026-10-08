import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Asset } from '../../../src/asset/asset.entity';
import { Organization } from '../../../src/organization/organization.entity';
import { ProductionEvent } from '../../../src/production-event/production-event.entity';
import { ReasonCode } from '../../../src/reason-code/reason-code.entity';
import { Tenant } from '../../../src/tenant/tenant.entity';
import { Unit } from '../../../src/unit/unit.entity';

export const DAY = '2026-10-07';

/** `at('08:30')` → 2026-10-07T08:30:00Z; pass another day for out-of-window rows. */
export function at(time: string, day = DAY): Date {
  return new Date(`${day}T${time}:00.000Z`);
}

export type EventKey = 'e1' | 'e2' | 'e3' | 'e4' | 'e5' | 'e6' | 'eB1';

export interface EventWorld {
  organizationId: string;
  tenantA: string;
  tenantB: string;
  unitA1: string;
  unitA2: string;
  unitA3: string;
  unitB1: string;
  assetA1: string;
  reasonR1: string;
  reasonR2: string;
  events: Record<EventKey, string>;
}

/**
 * Two tenants, three units in A, two reasons, seven events (T13 fixture):
 *
 * | key | tenant | unit | reason | type           | window (UTC, 7 Oct)      |
 * | e1  | A      | A1   | R1     | ProductionLoss | 08:00–09:00              |
 * | e2  | A      | A1   | R2     | IOW            | 09:30–10:00              |
 * | e3  | A      | A2   | R1     | ProductionLoss | 08:30–09:30              |
 * | e4  | A      | A2   | R1     | ProductionLoss | 12:00–(running)          |
 * | e5  | A      | A3   | R2     | SOL            | 07:00–07:30              |
 * | e6  | A      | A1   | R1     | ProductionLoss | 6 Oct 08:00–09:00        |
 * | eB1 | B      | B1   | R1     | ProductionLoss | 08:00–09:00              |
 */
export async function seedEventWorld(
  dataSource: DataSource,
): Promise<EventWorld> {
  const suffix = randomUUID().slice(0, 8);
  const world: EventWorld = {
    organizationId: randomUUID(),
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    unitA1: randomUUID(),
    unitA2: randomUUID(),
    unitA3: randomUUID(),
    unitB1: randomUUID(),
    assetA1: randomUUID(),
    reasonR1: randomUUID(),
    reasonR2: randomUUID(),
    events: {
      e1: randomUUID(),
      e2: randomUUID(),
      e3: randomUUID(),
      e4: randomUUID(),
      e5: randomUUID(),
      e6: randomUUID(),
      eB1: randomUUID(),
    },
  };

  await dataSource.getRepository(Organization).insert({
    id: world.organizationId,
    code: `ORG-${suffix}`,
    name: 'Test organisation',
    isActive: true,
  });
  await dataSource.getRepository(Tenant).insert([
    {
      id: world.tenantA,
      code: `TEN-A-${suffix}`,
      name: 'Tenant A',
      organizationId: world.organizationId,
      isActive: true,
    },
    {
      id: world.tenantB,
      code: `TEN-B-${suffix}`,
      name: 'Tenant B',
      organizationId: world.organizationId,
      isActive: true,
    },
  ]);
  await dataSource
    .getRepository(Unit)
    .insert([
      unit(
        world.unitA1,
        `unit100-${suffix}`,
        world.tenantA,
        world.organizationId,
      ),
      unit(
        world.unitA2,
        `unit200-${suffix}`,
        world.tenantA,
        world.organizationId,
      ),
      unit(
        world.unitA3,
        `unit300-${suffix}`,
        world.tenantA,
        world.organizationId,
      ),
      unit(
        world.unitB1,
        `unitB-${suffix}`,
        world.tenantB,
        world.organizationId,
      ),
    ]);
  await dataSource.getRepository(Asset).insert({
    id: world.assetA1,
    code: `EXT-${suffix}`,
    name: 'Extruder',
    unitId: world.unitA1,
    tenantId: world.tenantA,
    organizationId: world.organizationId,
  });
  await dataSource.getRepository(ReasonCode).insert([
    {
      id: world.reasonR1,
      code: `R1-${suffix}`,
      name: 'Mechanical',
      isActive: true,
      tenantId: world.tenantA,
    },
    {
      id: world.reasonR2,
      code: `R2-${suffix}`,
      name: 'Electrical',
      isActive: true,
      tenantId: world.tenantA,
    },
  ]);

  const { events: e } = world;
  await dataSource.getRepository(ProductionEvent).insert([
    event(
      e.e1,
      world.tenantA,
      world.unitA1,
      world.reasonR1,
      'ProductionLoss',
      'Open',
      at('08:00'),
      at('09:00'),
      {
        assetId: world.assetA1,
        quantity: 12.5,
      },
    ),
    event(
      e.e2,
      world.tenantA,
      world.unitA1,
      world.reasonR2,
      'IOW',
      'Closed',
      at('09:30'),
      at('10:00'),
    ),
    event(
      e.e3,
      world.tenantA,
      world.unitA2,
      world.reasonR1,
      'ProductionLoss',
      'Open',
      at('08:30'),
      at('09:30'),
    ),
    event(
      e.e4,
      world.tenantA,
      world.unitA2,
      world.reasonR1,
      'ProductionLoss',
      'Open',
      at('12:00'),
      null,
    ),
    event(
      e.e5,
      world.tenantA,
      world.unitA3,
      world.reasonR2,
      'SOL',
      'Closed',
      at('07:00'),
      at('07:30'),
    ),
    event(
      e.e6,
      world.tenantA,
      world.unitA1,
      world.reasonR1,
      'ProductionLoss',
      'Closed',
      at('08:00', '2026-10-06'),
      at('09:00', '2026-10-06'),
    ),
    event(
      e.eB1,
      world.tenantB,
      world.unitB1,
      world.reasonR1,
      'ProductionLoss',
      'Open',
      at('08:00'),
      at('09:00'),
    ),
  ]);

  return world;
}

/** Inserts one more tenant-A event (used to prove cursor stability while rows arrive). */
export async function insertTenantAEvent(
  dataSource: DataSource,
  world: EventWorld,
  startTime: Date,
  endTime: Date | null,
): Promise<string> {
  const id = randomUUID();
  await dataSource
    .getRepository(ProductionEvent)
    .insert(
      event(
        id,
        world.tenantA,
        world.unitA3,
        world.reasonR2,
        'ProductionLoss',
        'Open',
        startTime,
        endTime,
      ),
    );
  return id;
}

function unit(
  id: string,
  code: string,
  tenantId: string,
  organizationId: string,
): Partial<Unit> {
  return { id, code, name: code, tenantId, organizationId };
}

function event(
  id: string,
  tenantId: string,
  unitId: string,
  reasonCodeId: string,
  eventType: string,
  status: string,
  startTime: Date,
  endTime: Date | null,
  extra: Partial<ProductionEvent> = {},
): Partial<ProductionEvent> {
  return {
    id,
    eventId: `EVT-${id.slice(0, 8)}`,
    tenantId,
    unitId,
    reasonCodeId,
    eventType,
    status,
    startTime,
    endTime: endTime ?? undefined,
    source: 'Manual',
    description: `${eventType} on ${unitId.slice(0, 8)}`,
    ...extra,
  };
}
