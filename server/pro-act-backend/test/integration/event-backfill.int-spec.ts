import { randomUUID } from 'crypto';
import {
  classifyLegacyEventType,
  sourceKindOf,
} from '../../src/domain/events/event-classification';
import { fromLegacyStatus } from '../../src/domain/events/legacy-status';
import { ProductionEvent } from '../../src/production-event/production-event.entity';
import {
  CODING_FIELDS,
  EFFECTIVE_FIELDS,
  factsOf,
  SOURCE_FIELDS,
} from '../../src/production-event/revisions/event-facts';
import { IntegrationHarness } from './harness';
import { at, EventWorld, seedEventWorld } from './support/seed-event-world';

interface LegacyRow {
  eventType: string | null;
  status: string | null;
  source: string | null;
  end: Date | null;
  reason: boolean;
  rca: boolean;
  duration: number | null;
}

const SENTINEL = new Date('9999-12-31T00:00:00.000Z');

/** Legacy shapes found in v1 data: every type, every status label, PI sentinel, mixed sources. */
const LEGACY_ROWS: LegacyRow[] = [
  {
    eventType: 'ProductionLoss',
    status: 'Open',
    source: 'PI',
    end: SENTINEL,
    reason: false,
    rca: false,
    duration: 30,
  },
  {
    eventType: 'ProductionLoss',
    status: 'Coded',
    source: 'Manual',
    end: at('09:00'),
    reason: true,
    rca: false,
    duration: 1.5,
  },
  {
    eventType: 'ProductionLoss',
    status: 'RCA Required',
    source: 'PI',
    end: at('09:00'),
    reason: false,
    rca: true,
    duration: null,
  },
  {
    eventType: 'IOW',
    status: 'Investigating',
    source: 'Simulated PI',
    end: null,
    reason: false,
    rca: true,
    duration: null,
  },
  {
    eventType: 'SOL',
    status: 'In Progress',
    source: 'CMMS',
    end: at('09:00'),
    reason: false,
    rca: false,
    duration: 12,
  },
  {
    eventType: 'FailureWO',
    status: 'Completed',
    source: null,
    end: at('09:00'),
    reason: true,
    rca: true,
    duration: null,
  },
  {
    eventType: 'ProductionOutput',
    status: 'Closed',
    source: 'Manual',
    end: at('09:00'),
    reason: false,
    rca: false,
    duration: null,
  },
  {
    eventType: 'APM',
    status: 'Cancelled',
    source: 'PI',
    end: null,
    reason: false,
    rca: false,
    duration: null,
  },
  {
    eventType: null,
    status: null,
    source: null,
    end: null,
    reason: true,
    rca: false,
    duration: null,
  },
];

/** Migrations after EventIntervalModel; reverted so legacy rows are inserted in the pre-1.1 shape. */
// EventRevisions, HierarchyMappingAndCodeLibraries, EventOperations, IntakeCore, PiConnectionsToIntegrationConnections,
// PiCertifiedIntake, SignalsAndSamples, Calendars, ProfilesAndRates, PlanVersions, PeriodsActuals
const MIGRATIONS_AFTER_INTERVAL_MODEL = 11;

/**
 * Plan 1.1 step 4: the migration's SQL backfill gives the same answers as the TypeScript rules.
 * Plan 1.2 step 2: EventRevisions then snapshots the same rows exactly as `factsOf()` would.
 */
describe('EventIntervalModel + EventRevisions backfill', () => {
  const harness = new IntegrationHarness();
  let world: EventWorld;
  const ids: string[] = [];
  const legacyTenantId = randomUUID();

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    const rca = await insertRca(world);
    for (let undo = 0; undo <= MIGRATIONS_AFTER_INTERVAL_MODEL; undo++) {
      await harness.dataSource.undoLastMigration({ transaction: 'all' });
    }
    await harness.dataSource.query(
      `INSERT INTO production_events (id, unit_id, start_time, event_type, status, source, tenant_id)
       VALUES ($1, $2, $3, 'ProductionLoss', 'Open', 'PI', 'legacy-tenant')`,
      [legacyTenantId, world.unitA1, at('08:00')],
    );
    for (const row of LEGACY_ROWS) {
      const id = randomUUID();
      ids.push(id);
      await harness.dataSource.query(
        `INSERT INTO production_events (id, unit_id, start_time, end_time, event_type, status, source,
           reason_code_id, rca_id, duration, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          id,
          world.unitA1,
          at('08:00'),
          row.end,
          row.eventType,
          row.status,
          row.source,
          row.reason ? world.reasonR1 : null,
          row.rca ? rca : null,
          row.duration,
          world.tenantA,
        ],
      );
    }
    await harness.runMigrations();
  });

  afterAll(() => harness.stop());

  async function migrated(id: string): Promise<Record<string, unknown>> {
    const rows: Array<Record<string, unknown>> = await harness.dataSource.query(
      `SELECT * FROM production_events WHERE id = $1`,
      [id],
    );
    return rows[0];
  }

  it.each(LEGACY_ROWS.map((row, index) => [index, row] as const))(
    'row %i matches classifyLegacyEventType / fromLegacyStatus / sourceKindOf',
    async (index, row) => {
      const result = await migrated(ids[index]);
      const end =
        row.end && row.end.getTime() < SENTINEL.getTime() ? row.end : null;
      const classification = classifyLegacyEventType(row.eventType);
      const states = fromLegacyStatus(row.status, {
        hasEnd: end !== null,
        hasReasonCode: row.reason,
        hasRca: row.rca,
      });
      expect(result).toMatchObject({
        physical_type: classification.physicalType,
        oee_component: classification.oeeComponent,
        impact_mode: classification.impactMode,
        schedule_class: classification.scheduleClass,
        source_kind: sourceKindOf(row.source),
        physical_state: states.physicalState,
        coding_state: states.codingState,
        rca_state: states.rcaState,
        canonical_id: ids[index],
        tenant_uuid: world.tenantA,
        // legacy label untouched; the adapter rewrites it on the next write
        status: row.status,
      });
    },
  );

  it('T02 / B6: the PI sentinel becomes an open interval and is kept', async () => {
    const result = await migrated(ids[0]);
    expect(result.end_time).toBeNull();
    expect(result.duration_seconds).toBeNull();
    expect(new Date(result.legacy_end_sentinel as string).toISOString()).toBe(
      SENTINEL.toISOString(),
    );
  });

  it('keeps legacy durations, assuming minutes only for PI sources (MIG §18.2)', async () => {
    // raw SQL here: numerics come back as strings (the app installs the numeric parser, the harness does not)
    const legacy = async (index: number) => {
      const row = await migrated(ids[index]);
      return [Number(row.legacy_duration), row.legacy_duration_unit_assumed];
    };
    expect(await legacy(0)).toEqual([30, 'min']);
    expect(await legacy(1)).toEqual([1.5, null]);
    expect(await legacy(4)).toEqual([12, null]);
  });

  it('derives duration_seconds for closed rows', async () => {
    expect(Number((await migrated(ids[1])).duration_seconds)).toBe(3600);
  });

  it.each(LEGACY_ROWS.map((row, index) => [index, row] as const))(
    'row %i gets revision 1 and coding revision 1 equal to factsOf() (plan 1.2)',
    async (index, row) => {
      const event = await harness.dataSource
        .getRepository(ProductionEvent)
        .findOneByOrFail({ id: ids[index] });
      const isSource = sourceKindOf(row.source) !== 'manual';
      const [revision] = await rowsOf('event_revisions', ids[index]);
      expect(revision).toMatchObject({
        revision: 1,
        kind: isSource ? 'source' : 'user',
        actor_kind: 'system',
        tenant_id: world.tenantA,
        effective_facts: factsOf(event, EFFECTIVE_FIELDS),
        source_facts: isSource ? factsOf(event, SOURCE_FIELDS) : null,
      });
      const [coding] = await rowsOf('event_coding', ids[index]);
      expect(coding).toMatchObject({
        revision: 1,
        is_override: false,
        reason: 'baseline',
        old_values: {},
        new_values: factsOf(event, CODING_FIELDS),
        schedule_class: event.scheduleClass,
      });
      expect(event).toMatchObject({
        currentSourceRevision: isSource ? 1 : 0,
        currentCodingRevision: 1,
        duplicateDeliveries: 0,
        userOverrides: {},
      });
    },
  );

  it('keeps no revisions for an event without a uuid tenant (plan 1.2)', async () => {
    expect(await rowsOf('event_revisions', legacyTenantId)).toEqual([]);
    expect(await rowsOf('event_coding', legacyTenantId)).toEqual([]);
    expect((await migrated(legacyTenantId)).current_coding_revision).toBe(0);
  });

  it('keeps tenant_uuid in sync on later writes', async () => {
    await harness.dataSource.query(
      `UPDATE production_events SET tenant_id = $1 WHERE id = $2`,
      [world.tenantB, ids[1]],
    );
    expect((await migrated(ids[1])).tenant_uuid).toBe(world.tenantB);
    await harness.dataSource.query(
      `UPDATE production_events SET tenant_id = 'not-a-uuid' WHERE id = $1`,
      [ids[1]],
    );
    expect((await migrated(ids[1])).tenant_uuid).toBeNull();
  });

  function rowsOf(
    table: 'event_revisions' | 'event_coding',
    eventId: string,
  ): Promise<Array<Record<string, unknown>>> {
    return harness.dataSource.query(
      `SELECT * FROM ${table} WHERE event_id = $1 ORDER BY revision`,
      [eventId],
    );
  }

  async function insertRca(eventWorld: EventWorld): Promise<string> {
    const id = randomUUID();
    await harness.dataSource.query(
      `INSERT INTO rcas (id, title, status, tenant_id) VALUES ($1, 'legacy rca', 'Draft', $2)`,
      [id, eventWorld.tenantA],
    );
    return id;
  }
});
