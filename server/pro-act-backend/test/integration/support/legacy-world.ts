import { DataSource } from 'typeorm';
import { at, EventWorld, seedEventWorld } from './seed-event-world';

/** The §18.2 legacy shapes of the 3.10 remediation fixture, on top of the T13 event world. */
export interface LegacyWorld extends EventWorld {
  events: EventWorld['events'] & {
    tenantless: string;
    sentinel: string;
    unknownUnit: string;
    minuteMismatch: string;
    dupA: string;
    dupB: string;
    conflictA: string;
    conflictB: string;
  };
  planP1: string;
  planOrphan: string;
  lossL1: string;
  formLinked: string;
  formText: string;
  category: string;
  oeeSummary: string;
  periodDay: string;
  productRated: string;
}

interface EventRow {
  unitId: string;
  tenant: string | null;
  start: Date;
  end?: Date | null;
  eventId?: string;
  source?: string;
  quantity?: number;
  legacyDuration?: number;
  unitAssumed?: string;
}

async function insertEvent(
  dataSource: DataSource,
  row: EventRow,
): Promise<string> {
  const rows: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO "production_events" ("unit_id", "tenant_id", "start_time", "end_time", "event_id", "source",
            "event_type", "quantity", "legacy_duration", "legacy_duration_unit_assumed")
     VALUES ($1, $2, $3, $4, $5, $6, 'ProductionLoss', $7, $8, $9) RETURNING "id"`,
    [
      row.unitId,
      row.tenant,
      row.start,
      row.end ?? null,
      row.eventId ?? null,
      row.source ?? 'Manual',
      row.quantity ?? null,
      row.legacyDuration ?? null,
      row.unitAssumed ?? null,
    ],
  );
  return rows[0].id;
}

async function insertOne(
  dataSource: DataSource,
  sql: string,
  params: unknown[],
): Promise<string> {
  const rows: Array<{ id: string }> = await dataSource.query(sql, params);
  return rows[0].id;
}

type LegacyEventKey = Exclude<
  keyof LegacyWorld['events'],
  keyof EventWorld['events']
>;
type LegacyEventSpec = Omit<EventRow, 'unitId' | 'tenant'> & {
  tenant?: string | null;
};

const PI_SENTINEL = new Date('9999-12-31T23:59:59Z');

/** Legacy event shapes (unit A1, tenant A unless stated; `tenant_id` is uuid since DB-05, so tenantless = null). */
const LEGACY_EVENTS: ReadonlyArray<[LegacyEventKey, LegacyEventSpec]> = [
  ['tenantless', { tenant: null, start: at('11:00') }],
  ['sentinel', { start: at('13:00'), end: PI_SENTINEL, source: 'PI' }],
  ['unknownUnit', { start: at('14:00'), end: at('14:30'), legacyDuration: 30 }],
  [
    'minuteMismatch',
    {
      start: at('15:00'),
      end: at('15:30'),
      source: 'PI',
      legacyDuration: 45,
      unitAssumed: 'min',
    },
  ],
  [
    'dupA',
    {
      start: at('16:00'),
      end: at('16:10'),
      eventId: 'PI-DUP-1',
      source: 'PI',
      quantity: 5,
    },
  ],
  [
    'dupB',
    {
      start: at('16:00'),
      end: at('16:10'),
      eventId: 'PI-DUP-1',
      source: 'PI',
      quantity: 5,
    },
  ],
  [
    'conflictA',
    {
      start: at('17:00'),
      end: at('17:10'),
      eventId: 'PI-DUP-2',
      source: 'PI',
      quantity: 5,
    },
  ],
  [
    'conflictB',
    {
      start: at('17:00'),
      end: at('17:10'),
      eventId: 'PI-DUP-2',
      source: 'PI',
      quantity: 7,
    },
  ],
];

async function legacyEvents(
  dataSource: DataSource,
  world: EventWorld,
): Promise<LegacyWorld['events']> {
  const ids: Partial<Record<LegacyEventKey, string>> = {};
  for (const [key, spec] of LEGACY_EVENTS) {
    ids[key] = await insertEvent(dataSource, {
      ...spec,
      unitId: world.unitA1,
      tenant: spec.tenant === undefined ? world.tenantA : spec.tenant,
    });
  }
  return { ...world.events, ...(ids as Record<LegacyEventKey, string>) };
}

async function legacyPlans(dataSource: DataSource, world: EventWorld) {
  const plan = (
    unitText: string,
    tenant: string | null,
    unitRef: string | null,
  ) =>
    insertOne(
      dataSource,
      `INSERT INTO "production_plans" ("plan_name", "unit_id", "tenant_id", "unit_ref_id", "start_date", "end_date",
              "target_quantity", "actual_quantity")
       VALUES ($1, $2, $3, $4, $5, $6, 100, 90) RETURNING "id"`,
      [
        `Legacy plan ${unitText}`,
        unitText,
        tenant,
        unitRef,
        at('00:00', '2026-10-01'),
        at('00:00', '2026-11-01'),
      ],
    );
  return {
    planP1: await plan(world.unitA1, world.tenantA, world.unitA1),
    planOrphan: await plan('extruder-line-9', null, null),
  };
}

async function legacyAccounting(
  dataSource: DataSource,
  world: EventWorld,
  planP1: string,
) {
  const tenant = world.tenantA;
  const lossL1 = await insertOne(
    dataSource,
    `INSERT INTO "production_losses" ("plan_id", "period", "actual", "short_range_plan", "losses", "cost", "tenant_id")
     VALUES ($1, '2026-10-07', 90, 100, 10, 5, $2) RETURNING "id"`,
    [planP1, tenant],
  );
  const form = (productionEvent: string) =>
    insertOne(
      dataSource,
      `INSERT INTO "reconcile_forms" ("lossId", "totalLossAmount", "categorizedLossAmount", "unaccountedLossAmount",
              "productionEvent", "comment", "status", "categories", "tenantId")
       VALUES ($1, 10, 8, 2, $2, 'legacy', 'Submitted', '[]', $3) RETURNING "id"`,
      [lossL1, productionEvent, tenant],
    );
  const formLinked = await form(world.events.e1);
  const formText = await form('pump trip on line 1');
  const code = (table: string, code: string) =>
    insertOne(
      dataSource,
      `INSERT INTO "${table}" ("code", "name", "tenant_id") VALUES ($1, $1, $2) RETURNING "id"`,
      [code, tenant],
    );
  const category = await insertOne(
    dataSource,
    `INSERT INTO "loss_categories" ("reconcileFormId", "categoryName", "lossAmount", "impactCodeId", "oeeCodeId", "description", "tenantId")
     VALUES ($1, 'Mechanical', 8, $2, $3, 'legacy', $4) RETURNING "id"`,
    [
      formLinked,
      await code('impact_codes', 'IMP-L'),
      await code('oee_codes', 'OEE-L'),
      tenant,
    ],
  );
  return { lossL1, formLinked, formText, category };
}

/**
 * Seeds the T13 world plus legacy rows: an event without a tenant, a PI 9999 sentinel written after
 * 1.1, durations of unknown unit / disagreeing minutes, an identical and a conflicting duplicate pair, a
 * plan without tenant or unit evidence, a v1 loss / reconcile form (linked and free-text) / loss category
 * / OEE summary, one generated period of 7 Oct and a product with `standard_rate` and no unit.
 */
export async function seedLegacyWorld(
  dataSource: DataSource,
): Promise<LegacyWorld> {
  const world = await seedEventWorld(dataSource);
  const events = await legacyEvents(dataSource, world);
  const { planP1, planOrphan } = await legacyPlans(dataSource, world);
  const accounting = await legacyAccounting(dataSource, world, planP1);
  const oeeSummary = await insertOne(
    dataSource,
    `INSERT INTO "oee_summaries" ("plan_id", "availability", "oee", "period") VALUES ($1, 92.5, 81.25, '2026-10') RETURNING "id"`,
    [planP1],
  );
  const periodDay = await insertOne(
    dataSource,
    `INSERT INTO "production_periods" ("tenant_id", "row_version", "unit_id", "utc_start", "utc_end", "local_date", "shift_name")
     VALUES ($1, 1, $2, $3, $4, '2026-10-07', 'A') RETURNING "id"`,
    [world.tenantA, world.unitA1, at('02:30'), at('10:30')],
  );
  const productRated = await insertOne(
    dataSource,
    `INSERT INTO "products" ("code", "name", "tenant_id", "standard_rate") VALUES ('HDPE-L', 'Legacy HDPE', $1, 12.5) RETURNING "id"`,
    [world.tenantA],
  );
  return {
    ...world,
    ...accounting,
    oeeSummary,
    events,
    planP1,
    planOrphan,
    periodDay,
    productRated,
  };
}
