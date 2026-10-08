import { randomUUID } from 'crypto';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';

/**
 * Plan 1.7 step 1: migration SignalsAndSamples seeds signals from `historian_tags` bound to a unit —
 * one active PI connection in the tenant and an `exact_path` source mapping of the tag's AF element to
 * exactly one unit. Unbound, disabled, ambiguous and WebId-less tags are not seeded; nothing is guessed
 * (seeded signals are `other` until configured).
 */
describe('SignalsAndSamples crosswalk from historian_tags', () => {
  const harness = new IntegrationHarness();
  let world: EventWorld;
  let connectionId: string;
  const rows = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    harness.dataSource.query<T[]>(sql, params);

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    await harness.dataSource.undoLastMigration({ transaction: 'all' });
    connectionId = randomUUID();
    await rows(
      `INSERT INTO integration_connections (id, tenant_id, source_type, display_name, row_version)
       VALUES ($1, $2, 'pi_web_api', 'PI', 1)`,
      [connectionId, world.tenantA],
    );
    await mapping('sim-af/hdpe/unit100', world.unitA1);
    await mapping('sim-af/hdpe/shared', world.unitA1);
    await mapping('sim-af/hdpe/shared', world.unitA2, 'PI', connectionId);
    await tag({
      webId: 'PT-1',
      path: '\\\\SIM-AF\\HDPE/Unit100|Feed Rate',
      uom: 't/h',
    });
    await tag({ webId: 'PT-2', path: '\\\\SIM-AF\\HDPE\\Unit999|Rate' });
    await tag({
      webId: 'PT-3',
      path: '\\\\SIM-AF\\HDPE\\Unit100|Old',
      enabled: false,
    });
    await tag({ webId: null, path: '\\\\SIM-AF\\HDPE\\Unit100|NoWebId' });
    await tag({ webId: 'PT-4', path: '\\\\SIM-AF\\HDPE\\Shared|Rate' });
    await harness.runMigrations();
  });

  afterAll(async () => {
    await harness.stop();
  });

  const mapping = (
    path: string,
    unitId: string,
    system = 'PI',
    connection: string | null = null,
  ) =>
    rows(
      `INSERT INTO source_mappings (tenant_id, connection_id, source_system, match_kind, match_value, normalized_value,
              target_type, target_id, row_version)
       VALUES ($1, $2, $3, 'exact_path', $4, $4, 'unit', $5, 1)`,
      [world.tenantA, connection, system, path, unitId],
    );
  const tag = (input: {
    webId: string | null;
    path: string;
    uom?: string;
    enabled?: boolean;
  }) =>
    rows(
      `INSERT INTO historian_tags (tenant_id, web_id, tag_name, tag_path, unit_of_measure, update_interval, enabled)
       VALUES ($1, $2, $3, $4, $5, 10, $6)`,
      [
        world.tenantA,
        input.webId,
        `tag ${input.webId}`,
        input.path,
        input.uom ?? null,
        input.enabled ?? true,
      ],
    );

  it('seeds exactly the tag bound to one unit, as an unconfigured signal', async () => {
    const seeded = await rows<Record<string, unknown>>(
      `SELECT source_key, unit_id, connection_id, semantic_type, canonical_uom, cadence_seconds,
              source_binding->>'path' AS path, effective_from = to_timestamp(0) AS from_start
         FROM signals`,
    );

    expect(seeded).toEqual([
      {
        source_key: 'PT-1',
        unit_id: world.unitA1,
        connection_id: connectionId,
        semantic_type: 'other',
        canonical_uom: 't/h',
        cadence_seconds: 10,
        path: '\\\\SIM-AF\\HDPE/Unit100|Feed Rate',
        from_start: true,
      },
    ]);
  });
});
