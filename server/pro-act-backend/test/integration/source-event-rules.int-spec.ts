import { Type } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AttributeMappingService } from '../../src/attribute-mapping/attribute-mapping.service';
import { IntegrationModule } from '../../src/integration/integration.module';
import {
  FrameContext,
  PiEventFrame,
  PiFrameIngestService,
} from '../../src/integration/pi-frame-ingest.service';
import { TenantMappingResolver } from '../../src/source-mapping/source-mapping.service';
import { DerivedStopEngineService } from '../../src/stop-events/derived-stop-engine.service';
import { A, SignalSpec } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';

const MINUTE = 60_000;

interface ClassifiedRow {
  id: string;
  schedule_class: string;
  oee_component: string;
  classification_basis: Record<string, { source: string; ruleId: string }>;
  user_overrides: Record<string, number> | null;
}

class SourceRulesWorld extends AccountingWorld {
  protected extraModules(): Array<Type<unknown>> {
    return [IntegrationModule];
  }
}

/**
 * Plan 3.8 on source events: the tenant's active `coding_default` rules fill the axes an MQTT (PI path)
 * event and a state-engine stop leave open, with the `declarative_rule` basis; values the source, the
 * engine or the reason code state are never overwritten, and a source revision keeps the rule defaults.
 */
describe('coding_default rules on MQTT and state-engine events (plan 3.8)', () => {
  const env = new SourceRulesWorld();
  const ruleId = randomUUID();
  let reasonId = '';

  const classified = async (where: string, param: string) =>
    (
      await env.rows<ClassifiedRow>(
        `SELECT "id", "schedule_class", "oee_component", "classification_basis", "user_overrides"
           FROM "production_events" WHERE ${where} = $1`,
        [param],
      )
    )[0];
  const mqttContext = async (): Promise<FrameContext> => ({
    tenantId: env.world.tenantA,
    sourceSystem: 'MQTT',
    profile: await env.app
      .get(AttributeMappingService)
      .loadProfile(env.world.tenantA, null),
    resolver: {
      resolve: () => ({
        status: 'mapped',
        tier: 'pattern',
        unitId: env.world.unitA2,
        assetId: null,
        mappingId: 'test-mapping',
        version: 1,
        origin: 'pattern',
      }),
    } as unknown as TenantMappingResolver,
  });
  const frame = (fromMin: number, toMin: number): PiEventFrame => ({
    WebId: `mqtt-${randomUUID()}`,
    TemplateName: 'Production Loss',
    StartTime: plus(A, fromMin * MINUTE),
    EndTime: plus(A, toMin * MINUTE),
    Path: 'site/area/line/unit-a2',
    PrimaryReferencedElement: { WebId: null, Path: 'site/area/line/unit-a2' },
  });

  beforeAll(async () => {
    await env.start();
    const definition = {
      when: {
        all: [{ field: 'sourceKind', op: 'in', value: ['source', 'derived'] }],
      },
      then: [
        { set: 'scheduleClass', value: 'external' },
        { set: 'oeeComponent', value: 'quality' },
      ],
    };
    await env.rows(
      `INSERT INTO "rules" ("id", "tenant_id", "row_version", "kind", "name", "priority", "state", "active_version")
       VALUES ($1, $2, 1, 'coding_default', 'Source events are external quality', 10, 'active', 1)`,
      [ruleId, env.world.tenantA],
    );
    await env.rows(
      `INSERT INTO "rule_versions" ("tenant_id", "row_version", "rule_id", "version", "definition", "origin",
                                    "approved_by", "effective_from")
       VALUES ($1, 1, $2, 1, $3, 'activation', $4, now())`,
      [env.world.tenantA, ruleId, JSON.stringify(definition), randomUUID()],
    );
    reasonId = randomUUID();
    await env.rows(
      `INSERT INTO "reason_codes" ("id", "code", "name", "tenant_id", "is_active", "default_schedule_class")
       VALUES ($1, 'PLN-RULES', 'Planned cleaning', $2, true, 'planned')`,
      [reasonId, env.world.tenantA],
    );
  });
  afterAll(() => env.stop());

  it('fills the open axes of an MQTT-created event with the declarative_rule basis', async () => {
    const delivered = frame(-300, -270);
    const ingest = env.app.get(PiFrameIngestService);
    const result = await ingest.ingest(await mqttContext(), delivered, {});
    expect(result.outcome).toBe('created');
    const event = await classified('"event_id"', delivered.WebId);
    expect(event).toMatchObject({
      schedule_class: 'external',
      oee_component: 'quality',
      classification_basis: {
        scheduleClass: { source: 'declarative_rule', ruleId },
        oeeComponent: { source: 'declarative_rule', ruleId },
      },
    });
    // a source revision keeps the rule defaults (they are not user overrides)
    const revised = await ingest.ingest(
      await mqttContext(),
      { ...delivered, EndTime: plus(A, -260 * MINUTE) },
      {},
    );
    expect(revised.outcome).toBe('updated');
    const after = await classified('"id"', event.id);
    expect(after).toMatchObject({
      schedule_class: 'external',
      oee_component: 'quality',
      classification_basis: event.classification_basis,
    });
    expect(after.user_overrides ?? {}).toEqual({});
  });

  it('never overwrites the schedule class the delivered reason code states', async () => {
    const delivered = frame(-240, -200);
    await env.app
      .get(PiFrameIngestService)
      .ingest(await mqttContext(), delivered, {
        ReasonCode: { Name: 'Planned cleaning', Value: 7, IsSystem: false },
      });
    const event = await classified('"event_id"', delivered.WebId);
    expect(event).toMatchObject({
      schedule_class: 'planned',
      oee_component: 'quality',
      classification_basis: {
        scheduleClass: { source: 'code_default' },
        oeeComponent: { source: 'declarative_rule', ruleId },
      },
    });
  });

  it('fills the open OEE component of a derived stop and keeps the engine schedule class', async () => {
    const signalId = await env.signal({
      unitId: env.world.unitA1,
      semanticType: 'state',
      from: plus(A, -24 * 60 * MINUTE),
      to: null,
    } as unknown as SignalSpec);
    await env
      .post('unit-state-mappings', {
        unitId: env.world.unitA1,
        signalId,
        rules: [
          { match: '1', state: 'running' },
          { match: '0', state: 'internal_stop' },
        ],
        expectedIntervalSeconds: 60,
        effectiveFrom: plus(A, -60 * MINUTE),
      })
      .expect(201);
    const points = Array.from({ length: 125 }, (_, i): [number, string] => [
      i,
      i >= 60 && i < 90 ? '0' : '1',
    ]);
    await env.samples(signalId, A, points);
    const outcome = await env.app
      .get(DerivedStopEngineService)
      .processUnit(
        { tenantId: env.world.tenantA, unitId: env.world.unitA1 },
        new Date(Date.parse(A) + 125 * MINUTE),
      );
    expect(outcome.created).toBe(1);
    const [stop] = await env.rows<ClassifiedRow>(
      `SELECT "id", "schedule_class", "oee_component", "classification_basis"
         FROM "production_events" WHERE "unit_id" = $1 AND "source_kind" = 'derived'`,
      [env.world.unitA1],
    );
    expect(stop).toMatchObject({
      schedule_class: 'unplanned',
      oee_component: 'quality',
      classification_basis: {
        oeeComponent: { source: 'declarative_rule', ruleId },
      },
    });
    expect(stop.classification_basis.scheduleClass).toBeUndefined();
  });
});
