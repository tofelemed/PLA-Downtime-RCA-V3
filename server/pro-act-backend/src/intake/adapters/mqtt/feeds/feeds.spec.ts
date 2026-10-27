import { validateEnvelope } from '../../../envelope/envelope-validator';
import { DecodeResult } from '../decode-result';
import { parseMqttConfig, validateMqttConfig } from '../mqtt-config';
import { exampleMqttConfig } from '../mqtt-config.example';
import {
  EXAMPLE_CONNECTION_ID,
  EXAMPLE_TENANT_ID,
  examplePacket,
} from '../mqtt-decode.example';
import { decodeMqttMessage } from '../profiles';

const UNIT_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';

const FEEDS = [
  {
    id: 'pla',
    purpose: 'pla',
    topic: 'marun/hdpe/pla',
    unitId: UNIT_ID,
    productId: PRODUCT_ID,
  },
  { id: 'downtime', purpose: 'downtime', topic: 'marun/hdpe/downtime' },
];

function feedsConfig(feeds: unknown = FEEDS): Record<string, unknown> {
  const base = exampleMqttConfig();
  return {
    mqtt: {
      ...(base.mqtt as Record<string, unknown>),
      topics: [],
      availabilityTopic: undefined,
    },
    payloadProfile: { kind: 'feeds', feeds },
  };
}

/** The owner's sample PLA payload (26 Oct 2026). */
const PLA = {
  event_type: 'PRODUCTION_LOSS_DETECTED',
  schema_version: '1.0',
  event_id: 'MARUN-HDPE-20261025',
  event_revision: 1,
  plant: 'MARUN_HDPE',
  production_date: '2026-10-25',
  period_start: '2026-10-25T00:00:00+03:30',
  period_end: '2026-10-26T00:00:00+03:30',
  plan: {
    source: 'PLANNING_SYSTEM_TBD',
    plan_id: 'PLAN-20261025',
    revision: 1,
    approved: true,
    planned_production_t: 240,
  },
  production: {
    actual_good_production_t: 208,
    shortfall_t: 32,
    measurement_quality: 'GOOD',
  },
  pi_source: { actual_tag: 'PI_TAG_TBD', event_frame_id: 'PI_EVENT_ID_TBD' },
  status: 'DETECTED',
};

const STOP = {
  event_type: 'DOWNTIME',
  event_id: 'EXT1-0612',
  event_revision: 1,
  plant: 'MARUN_HDPE',
  unit: 'Extruder1',
  equipment: 'EXT1-Main',
  start_time: '2026-10-25T06:12:00+03:30',
  end_time: '2026-10-25T06:47:00+03:30',
  reason_code: 'MECH-GEARBOX',
  description: 'Gearbox high vibration trip',
  lost_production_t: 7.3,
};

function decode(
  topic: string,
  payload: unknown,
  feeds: unknown = FEEDS,
): DecodeResult {
  const config = parseMqttConfig(feedsConfig(feeds));
  return decodeMqttMessage(
    examplePacket(
      { topic, payload },
      {
        tenantId: EXAMPLE_TENANT_ID,
        connectionId: EXAMPLE_CONNECTION_ID,
        configVersion: 1,
        config,
      },
    ),
  );
}

function ok(result: DecodeResult) {
  if (!result.ok) throw new Error(`${result.code}: ${result.detail}`);
  const validation = validateEnvelope(result.envelope);
  expect(validation.valid ? [] : validation.violations).toEqual([]);
  return result.envelope;
}

/** MQTT feeds: PLA and downtime topics on one connection (plans/MQTT_FEEDS.md, owner 26 Oct 2026). */
describe('MQTT feeds', () => {
  describe('settings', () => {
    it('accepts feeds without mqtt.topics and subscribes the feed topics', () => {
      expect(validateMqttConfig(feedsConfig())).toEqual([]);
      expect(parseMqttConfig(feedsConfig()).mqtt.topics).toEqual([
        'marun/hdpe/pla',
        'marun/hdpe/downtime',
      ]);
    });

    it('refuses a PLA feed without a unit, overlapping topics, bad paths and contract keys', () => {
      const problems = validateMqttConfig(
        feedsConfig([
          { id: 'pla', purpose: 'pla', topic: 'marun/#' },
          {
            id: 'downtime',
            purpose: 'downtime',
            topic: 'marun/hdpe/downtime',
            fields: { start: 'start time', nope: 'x' },
            durationUnit: 'd',
          },
        ]),
      );
      expect(problems).toEqual(
        expect.arrayContaining([
          'payloadProfile.feeds[0].unitId: choose the unit the daily actual is booked to',
          'payloadProfile.feeds[1].fields.start: must be a dotted JSON path',
          'payloadProfile.feeds[1].fields.nope: not a downtime field',
          'payloadProfile.feeds[1].durationUnit: must be one of s, min, h',
          'payloadProfile.feeds[1].topic: overlaps the topic of feed pla',
        ]),
      );
      const withTemplate = {
        ...feedsConfig(),
        payloadProfile: {
          kind: 'feeds',
          feeds: FEEDS,
          topicTemplate: 'a/{unit}',
        },
      };
      expect(validateMqttConfig(withTemplate)).toContain(
        'payloadProfile.topicTemplate: not used by a feeds profile',
      );
    });
  });

  describe('PLA', () => {
    it('reads the sample payload as one declared production loss on the feed unit', () => {
      const envelope = ok(decode('marun/hdpe/pla', PLA));
      expect(envelope).toMatchObject({
        kind: 'interval_event',
        sourceObjectId: 'pla:MARUN-HDPE-20261025',
        messageId: 'pla:MARUN-HDPE-20261025:1',
        sourceRevision: '1',
        startTime: '2026-10-24T20:30:00.000Z',
        endTime: '2026-10-25T20:30:00.000Z',
        observedAt: '2026-10-25T20:30:00.000Z',
        location: { unitId: UNIT_ID },
        values: { templateName: 'Production Loss Declared' },
      });
      expect(envelope.values?.attributes).toEqual([
        { name: 'Planned', type: 'number', value: 240, unit: 't' },
        { name: 'Actual', type: 'number', value: 208, unit: 't' },
        { name: 'Shortfall', type: 'number', value: 32, unit: 't' },
        { name: 'MeasurementQuality', type: 'string', value: 'GOOD' },
        { name: 'Status', type: 'string', value: 'DETECTED' },
        { name: 'PlanSource', type: 'string', value: 'PLANNING_SYSTEM_TBD' },
        { name: 'PlanId', type: 'string', value: 'PLAN-20261025' },
        { name: 'PlanRevision', type: 'number', value: 1 },
        { name: 'PlanApproved', type: 'boolean', value: true },
        { name: 'PiActualTag', type: 'string', value: 'PI_TAG_TBD' },
        { name: 'PiEventFrameId', type: 'string', value: 'PI_EVENT_ID_TBD' },
      ]);
      expect(envelope.sourceControls?.mqtt).toMatchObject({
        feed: 'pla',
        feedId: 'pla',
        eventId: 'MARUN-HDPE-20261025',
      });
      expect(envelope.sourceControls?.mqtt).not.toHaveProperty('report');
    });

    it('keeps a negative shortfall for the handler, and needs actual and shortfall', () => {
      const negative = {
        ...PLA,
        production: { ...PLA.production, shortfall_t: -4 },
      };
      expect(
        ok(decode('marun/hdpe/pla', negative)).values?.attributes,
      ).toContainEqual({
        name: 'Shortfall',
        type: 'number',
        value: -4,
        unit: 't',
      });
      const result = decode('marun/hdpe/pla', {
        ...PLA,
        production: { actual_good_production_t: 208 },
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.detail).toContain(
        'shortfall (production.shortfall_t) is required',
      );
    });

    it('follows overridden paths and names every missing field', () => {
      const feeds = [{ ...FEEDS[0], fields: { actual: 'good_t' } }, FEEDS[1]];
      expect(
        ok(decode('marun/hdpe/pla', { ...PLA, good_t: '199.5' }, feeds)).values
          ?.attributes,
      ).toContainEqual({
        name: 'Actual',
        type: 'number',
        value: 199.5,
        unit: 't',
      });
      const result = decode('marun/hdpe/pla', {
        event_id: 'X',
        period_start: 'yesterday',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('SCHEMA_INVALID');
      expect(result.detail).toContain(
        'productionDate (production_date) is required',
      );
      expect(result.detail).toContain(
        'periodStart (period_start): "yesterday" is not RFC 3339',
      );
      expect(result.detail).toContain(
        'actual (production.actual_good_production_t) is required',
      );
    });
  });

  describe('downtime', () => {
    it('reads a closed stop with unit, equipment, reason and text (lost tonnes are not read)', () => {
      const envelope = ok(decode('marun/hdpe/downtime', STOP));
      expect(envelope).toMatchObject({
        kind: 'interval_event',
        sourceObjectId: 'downtime:EXT1-0612',
        startTime: '2026-10-25T02:42:00.000Z',
        endTime: '2026-10-25T03:17:00.000Z',
        observedAt: '2026-10-25T03:17:00.000Z',
        location: { sourcePath: 'Extruder1' },
        values: { templateName: 'Production Loss' },
      });
      expect(envelope.values?.attributes).toEqual([
        { name: 'ReasonCode', type: 'string', value: 'MECH-GEARBOX' },
        {
          name: 'Description',
          type: 'string',
          value: 'Gearbox high vibration trip',
        },
        { name: 'Equipment', type: 'string', value: 'EXT1-Main' },
      ]);
      expect(envelope.sourceControls?.mqtt).toMatchObject({
        feed: 'downtime',
        eventId: 'EXT1-0612',
        unit: 'Extruder1',
        equipment: 'EXT1-Main',
      });
    });

    it('keeps a stop without an end open, and derives the end from a duration', () => {
      const open: Record<string, unknown> = { ...STOP };
      delete open.end_time;
      expect(ok(decode('marun/hdpe/downtime', open)).endTime).toBeNull();
      const timed = ok(
        decode('marun/hdpe/downtime', { ...open, duration_min: 35 }),
      );
      expect(timed.endTime).toBe('2026-10-25T03:17:00.000Z');
      expect(timed.values?.attributes).toContainEqual({
        name: 'Duration',
        type: 'number',
        value: 2100,
        unit: 's',
      });
    });

    it('needs a unit or equipment and refuses a stop that ends before it starts', () => {
      const result = decode('marun/hdpe/downtime', {
        ...STOP,
        unit: null,
        equipment: null,
        end_time: '2026-10-25T06:00:00+03:30',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.detail).toContain(
        'unit (unit) or equipment (equipment) is required',
      );
      expect(result.detail).toContain('the stop must end after it starts');
    });
  });

  it('quarantines a message on a topic of no feed', () => {
    const config = parseMqttConfig({
      ...feedsConfig(),
      mqtt: {
        ...(feedsConfig().mqtt as Record<string, unknown>),
        topics: ['marun/hdpe/other'],
      },
    });
    const result = decodeMqttMessage(
      examplePacket(
        { topic: 'marun/hdpe/other', payload: STOP },
        {
          tenantId: EXAMPLE_TENANT_ID,
          connectionId: EXAMPLE_CONNECTION_ID,
          configVersion: 1,
          config,
        },
      ),
    );
    expect(result).toMatchObject({ ok: false, code: 'TOPIC_SHAPE' });
  });
});
