import { MqttAdapterModule } from '../../src/intake/adapters/mqtt/mqtt-adapter.module';
import { exampleMqttConfig } from '../../src/intake/adapters/mqtt/mqtt-config.example';
import { parseMqttConfig } from '../../src/intake/adapters/mqtt/mqtt-config';
import { examplePacket } from '../../src/intake/adapters/mqtt/mqtt-decode.example';
import { decodeMqttMessage } from '../../src/intake/adapters/mqtt/profiles';
import { IntakeService } from '../../src/intake/intake.service';
import { NormalizationService } from '../../src/intake/normalization/normalization.service';
import { AccountingWorld } from './support/accounting-world';

/**
 * MQTT feeds on one connection (plans/MQTT_FEEDS.md, owner 26 Oct 2026), isolated proact_test: the PLA
 * topic becomes external daily reports with OT's figures kept for comparison, the downtime topic becomes
 * stops placed by unit / equipment code (open, then closed by a later message of the same event id).
 */
describe('MQTT PLA and downtime feeds', () => {
  class FeedWorld extends AccountingWorld {
    protected extraModules() {
      return [MqttAdapterModule];
    }
  }
  const env = new FeedWorld();
  let unitCode = '';
  let assetCode = '';
  let reasonCode = '';

  const feeds = () => [
    {
      id: 'pla',
      purpose: 'pla',
      topic: 'marun/hdpe/pla',
      unitId: env.world.unitA1,
      productId: env.products.p1,
    },
    { id: 'downtime', purpose: 'downtime', topic: 'marun/hdpe/downtime' },
  ];
  const endpointConfig = () => ({
    mqtt: {
      ...(exampleMqttConfig().mqtt as Record<string, unknown>),
      topics: [],
      availabilityTopic: undefined,
    },
    payloadProfile: { kind: 'feeds', feeds: feeds() },
  });
  const deliver = async (topic: string, payload: unknown) => {
    const decoded = decodeMqttMessage(
      examplePacket(
        { topic, payload, receivedAt: new Date().toISOString() },
        {
          tenantId: env.world.tenantA,
          connectionId: env.connections.mqtt,
          configVersion: 1,
          config: parseMqttConfig(endpointConfig()),
        },
      ),
    );
    if (!decoded.ok) throw new Error(`${decoded.code}: ${decoded.detail}`);
    const accepted = await env.app
      .get(IntakeService)
      .accept(
        { tenantId: env.world.tenantA, connectionId: env.connections.mqtt },
        decoded.envelope,
      );
    return accepted.ticket
      ? {
          accepted,
          outcome: await env.app
            .get(NormalizationService)
            .normalize(accepted.ticket),
        }
      : { accepted, outcome: null };
  };
  const pla = (revision: number, actual: number) => ({
    event_type: 'PRODUCTION_LOSS_DETECTED',
    event_id: 'MARUN-HDPE-20261025',
    event_revision: revision,
    plant: 'MARUN_HDPE',
    production_date: '2026-10-25',
    period_start: '2026-10-25T00:00:00+03:30',
    period_end: '2026-10-26T00:00:00+03:30',
    plan: { planned_production_t: 240 },
    production: {
      actual_good_production_t: actual,
      shortfall_t: 240 - actual,
      measurement_quality: 'GOOD',
    },
    status: 'DETECTED',
  });
  const stop = (change: Record<string, unknown> = {}) => ({
    event_id: 'EXT1-0612',
    unit: unitCode.toUpperCase(),
    equipment: assetCode,
    start_time: '2026-10-25T06:12:00+03:30',
    reason_code: reasonCode,
    description: 'Gearbox high vibration trip',
    ...change,
  });

  beforeAll(async () => {
    await env.start();
    await env.rows(
      'UPDATE integration_connections SET endpoint_config = $1::jsonb WHERE id = $2',
      [JSON.stringify(endpointConfig()), env.connections.mqtt],
    );
    [{ code: unitCode }] = await env.rows<{ code: string }>(
      'SELECT code FROM units WHERE id = $1',
      [env.world.unitA1],
    );
    [{ code: assetCode }] = await env.rows<{ code: string }>(
      'SELECT code FROM assets WHERE id = $1',
      [env.world.assetA1],
    );
    [{ code: reasonCode }] = await env.rows<{ code: string }>(
      'SELECT code FROM reason_codes WHERE id = $1',
      [env.world.reasonR1],
    );
  });
  afterAll(() => env.stop());

  it('previews which feed a message belongs to, without storing it', async () => {
    const response = await env
      .post(`connections/${env.connections.mqtt}/mqtt-preview`, {
        topic: 'marun/hdpe/pla',
        payload: JSON.stringify(pla(1, 208)),
        receivedAt: new Date().toISOString(),
      })
      .expect(200);
    expect(response.body).toMatchObject({
      ok: true,
      kind: 'output_event',
      feed: { id: 'pla', purpose: 'pla' },
      bindingStatus: 'pla_report',
      feedFacts: { report: { planned: 240, actual: 208, shortfall: 32 } },
    });
    const downtime = await env
      .post(`connections/${env.connections.mqtt}/mqtt-preview`, {
        topic: 'marun/hdpe/downtime',
        payload: JSON.stringify(stop()),
        receivedAt: new Date().toISOString(),
      })
      .expect(200);
    expect(downtime.body).toMatchObject({
      ok: true,
      kind: 'interval_event',
      bindingStatus: 'downtime_event',
      endTime: null,
    });
  });

  it('stores a PLA day as an external report with OT figures; a later revision supersedes it', async () => {
    const first = await deliver('marun/hdpe/pla', pla(1, 208));
    expect(first.outcome).toMatchObject({
      status: 'processed',
      result: { status: 'applied', outcome: 'created' },
    });
    const repeated = await deliver('marun/hdpe/pla', pla(1, 208));
    expect(repeated.accepted.status).toBe('duplicate');
    await deliver('marun/hdpe/pla', pla(2, 212));
    const reports = await env.rows<{
      external_revision: string;
      state: string;
      source_system: string;
      connection_id: string;
      lines: Array<{ unitId: string; productId: string; good: string }>;
      source_figures: Record<string, unknown>;
    }>(
      `SELECT external_revision, state, source_system, connection_id, lines, source_figures FROM external_production_reports WHERE external_report_id = 'MARUN-HDPE-20261025' ORDER BY external_revision`,
    );
    expect(reports.map((row) => [row.external_revision, row.state])).toEqual([
      ['1', 'superseded'],
      ['2', 'current'],
    ]);
    expect(reports[1]).toMatchObject({
      source_system: 'MQTT',
      connection_id: env.connections.mqtt,
      lines: [
        { unitId: env.world.unitA1, productId: env.products.p1, good: '212' },
      ],
      source_figures: {
        planned: 240,
        actual: 212,
        shortfall: 28,
        status: 'DETECTED',
        quality: 'GOOD',
        plant: 'MARUN_HDPE',
      },
    });
  });

  it('opens a stop placed by unit and equipment code, and closes it with the end message', async () => {
    const opened = await deliver('marun/hdpe/downtime', stop());
    expect(opened.outcome).toMatchObject({
      status: 'processed',
      result: { status: 'applied', outcome: 'created' },
    });
    const closed = await deliver(
      'marun/hdpe/downtime',
      stop({ end_time: '2026-10-25T06:47:00+03:30', lost_production_t: 7.3 }),
    );
    expect(closed.outcome).toMatchObject({
      status: 'processed',
      result: { status: 'applied', outcome: 'updated' },
    });
    const events = await env.rows<{
      unit_id: string;
      asset_id: string;
      reason_code_id: string;
      source: string;
      start_time: Date;
      end_time: Date | null;
      description: string;
    }>(
      `SELECT unit_id, asset_id, reason_code_id, source, start_time, end_time, description FROM production_events WHERE event_id = 'EXT1-0612' AND tenant_id = $1`,
      [env.world.tenantA],
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      unit_id: env.world.unitA1,
      asset_id: env.world.assetA1,
      reason_code_id: env.world.reasonR1,
      source: 'MQTT',
      description: 'Gearbox high vibration trip',
    });
    expect(events[0].start_time.toISOString()).toBe('2026-10-25T02:42:00.000Z');
    expect(events[0].end_time?.toISOString()).toBe('2026-10-25T03:17:00.000Z');
  });

  it('quarantines a stop of an unknown unit with the code to bind', async () => {
    const result = await deliver(
      'marun/hdpe/downtime',
      stop({ event_id: 'PEL-1', unit: 'Pelletizer9', equipment: null }),
    );
    expect(result.outcome).toMatchObject({
      status: 'processed',
      result: { status: 'quarantined', errorCode: 'unknown_unit' },
    });
    const [exception] = await env.rows<{ detail: { sourcePath: string } }>(
      `SELECT detail FROM ingestion_exceptions WHERE source_object_id = 'downtime:PEL-1' AND state = 'open'`,
    );
    expect(exception.detail.sourcePath).toBe('Pelletizer9');
  });
});
