import { ExamplePacket } from '../mqtt-decode.example';
import {
  BOOT,
  decode,
  decodeOk,
  EVENT,
  events,
  expectFailure,
  MEASUREMENT_PROFILE,
  MEASUREMENT_TOPICS,
  SAMPLE,
  STATE,
  STATE_PROFILE,
  UNIT,
  Overrides,
} from './decode-spec-support';

describe('MQTT profile decoders (plan 1.8 WP3 step 2, design §5 envelope mapping)', () => {
  describe('interval events', () => {
    it('maps an upsert to an open interval event with typed attributes and the AF path as source path', () => {
      const envelope = decodeOk(
        events(EVENT, { retained: false, qos: 1, packetId: 9 }),
      );
      expect(envelope).toMatchObject({
        kind: 'interval_event',
        operation: 'observe',
        messageId: 'EF-1:2026-10-11T06:09:30.000Z',
        sourceObjectId: 'Extruder1:EF-1',
        sourceRevision: '2026-10-11T06:09:30.000Z',
        observedAt: '2026-10-11T06:09:30.100Z',
        receivedAt: '2026-10-11T06:10:00.000Z',
        startTime: '2026-10-11T05:40:00.000Z',
        endTime: null,
        location: { sourcePath: '\\\\PIAF\\HDPE\\Polymer\\Line1\\Extruder1' },
        values: {
          templateName: 'Production Loss',
          attributes: [
            {
              name: 'Reason Code',
              type: 'string',
              value: 'MECH-01',
              unit: null,
            },
            { name: 'Quantity', type: 'number', value: 2, unit: null },
          ],
        },
        provenance: {
          payloadHash: expect.stringMatching(/^sha256:/) as string,
          mappingVersion: 3,
          correlationId: `mqtt:${BOOT}`,
        },
        sourceControls: {
          mqtt: {
            topic: `${UNIT}/events`,
            retained: false,
            duplicate: false,
            qos: 1,
            packetId: 9,
            bootId: BOOT,
            sequence: 1844,
            source: 'gw',
            eventId: 'EF-1',
            revision: '2026-10-11T06:09:30.000Z',
          },
        },
      });
      expect(envelope.provenance.rawPayload).toEqual(EVENT);
    });

    it('keeps digital, boolean and null attributes typed', () => {
      const envelope = decodeOk(
        events({
          ...EVENT,
          attributes: {
            'Reason Code': { name: 'MECH-01', value: 3 },
            Flag: true,
            Note: null,
          },
        }),
        { payloadProfile: { fields: {} } },
      );
      expect(envelope.values?.attributes).toEqual([
        {
          name: 'Reason Code',
          type: 'digital',
          digital: { name: 'MECH-01', value: 3 },
          unit: null,
        },
        { name: 'Flag', type: 'boolean', value: true, unit: null },
        { name: 'Note', type: 'string', value: null, unit: null },
      ]);
    });

    it('an upsert without element_path is a contract violation (the topic fallback is for deletes)', () => {
      expectFailure(
        decode(events({ ...EVENT, element_path: undefined })),
        'SCHEMA_INVALID',
        'element_path',
      );
    });

    it('refuses an end before the start', () => {
      expectFailure(
        decode(events({ ...EVENT, end_ts: '2026-10-11T05:00:00.000Z' })),
        'SCHEMA_INVALID',
        'before start_ts',
      );
    });

    it('maps a delete to a retraction carrying the revision', () => {
      const envelope = decodeOk(
        events({
          schema_version: '1.0',
          event_id: 'EF-1',
          revision: 9,
          operation: 'delete',
          ts: EVENT.ts,
          seq: 1,
          boot_id: BOOT,
        }),
      );
      expect(envelope).toMatchObject({
        kind: 'retraction',
        operation: 'retract',
        messageId: 'EF-1:9',
        sourceObjectId: 'Extruder1:EF-1',
        sourceRevision: '9',
        location: { sourcePath: `${UNIT}/events` },
        retraction: { retractsRevision: '9' },
      });
      expect(envelope.startTime).toBeUndefined();
    });

    it('applies valueMaps.reason to the reason attribute and rejects or keeps unmapped tokens', () => {
      const reason = {
        payloadProfile: { valueMaps: { reason: { 'MECH-01': 'MECH-01-KEY' } } },
      };
      const mapped = decodeOk(events(EVENT), reason);
      expect(mapped.values?.attributes?.[0]).toMatchObject({
        name: 'Reason Code',
        value: 'MECH-01-KEY',
      });
      const unmapped = decode(
        events({ ...EVENT, attributes: { 'Reason Code': 'XYZ' } }),
        reason,
      );
      expectFailure(unmapped, 'UNMAPPED_VALUE', '"XYZ"');
      const kept = decodeOk(
        events({ ...EVENT, attributes: { 'Reason Code': 'XYZ' } }),
        {
          payloadProfile: { ...reason.payloadProfile, reasonUnmapped: 'keep' },
        },
      );
      expect(kept.values?.attributes?.[0]).toMatchObject({
        name: 'Reason Code',
        value: 'XYZ',
      });
    });

    it('honours seq_boot and payload_hash identity on events too', () => {
      const seqBoot = decodeOk(events(EVENT), {
        payloadProfile: { identityStrategy: 'seq_boot' },
      });
      expect(seqBoot.messageId).toBe(`Extruder1:${BOOT}:1844`);
      const hashed = decodeOk(events(EVENT), {
        payloadProfile: { identityStrategy: 'payload_hash' },
      });
      expect(hashed.messageId).toBe(
        `${hashed.provenance.payloadHash}:2026-10-11T06:09:30.100Z`,
      );
    });
  });

  describe('measurements', () => {
    const measurement = (
      payload: unknown,
      topic = `${UNIT}/measurements/Throughput`,
    ): [ExamplePacket, Overrides] => [
      { topic, payload },
      {
        mqtt: { topics: MEASUREMENT_TOPICS },
        payloadProfile: MEASUREMENT_PROFILE,
      },
    ];

    it('maps a numeric sample to values.sample for MeasurementHandler', () => {
      const envelope = decodeOk(...measurement(SAMPLE));
      expect(envelope).toMatchObject({
        kind: 'measurement',
        messageId: `Extruder1:${BOOT}:42`,
        sourceObjectId: `${UNIT}/measurements/Throughput@2026-10-11T06:07:14.187Z`,
        sourceRevision: '42',
        observedAt: '2026-10-11T06:07:14.187Z',
        location: { sourcePath: `${UNIT}/measurements/Throughput` },
        values: {
          sample: {
            signalRef: 'F1DP-throughput',
            value: 12.5,
            unit: 't/h',
            sequence: 42,
          },
        },
        quality: { status: 'good', degraded: false },
        sourceControls: { mqtt: { attribute: 'Throughput' } },
      });
    });

    it('puts a digital state in sample.digital with value null, a boolean as is', () => {
      const digital = decodeOk(
        ...measurement({
          ...SAMPLE,
          value: { name: 'RUN', value: 1 },
          uom: undefined,
        }),
      );
      expect(digital.values?.sample).toEqual({
        signalRef: 'F1DP-throughput',
        value: null,
        unit: null,
        sequence: 42,
        digital: { name: 'RUN', value: 1 },
      });
      expect(
        decodeOk(...measurement({ ...SAMPLE, value: false })).values?.sample
          ?.value,
      ).toBe(false);
    });

    it('event_id identity on a sample is SCHEMA_INVALID (no event id in the contract)', () => {
      const [packet, overrides] = measurement(SAMPLE);
      expectFailure(
        decode(packet, {
          ...overrides,
          payloadProfile: {
            ...MEASUREMENT_PROFILE,
            identityStrategy: 'event_id',
          },
        }),
        'SCHEMA_INVALID',
        'event_id and revision',
      );
    });
  });

  describe('states and availability', () => {
    const stateOverrides: Overrides = {
      mqtt: { topics: ['proact/v1/+/+/+/+/state'] },
      payloadProfile: STATE_PROFILE,
    };

    it('maps the state token through valueMaps.state and keeps the original event time of a retained state', () => {
      const envelope = decodeOk(
        {
          topic: `${UNIT}/state`,
          payload: { ...STATE, previous: { name: 'STOP', value: 0 } },
          retained: true,
        },
        stateOverrides,
      );
      expect(envelope).toMatchObject({
        kind: 'state',
        messageId: `Extruder1:${BOOT}:7`,
        sourceObjectId: `${UNIT}/state@2026-10-11T06:07:14.187Z`,
        sourceRevision: '7',
        observedAt: '2026-10-11T06:07:14.187Z',
        values: {
          state: {
            stateRef: `${UNIT}/state`,
            value: 'running',
            previousValue: 'stopped',
            sequence: 7,
          },
        },
        sourceControls: {
          mqtt: { retained: true, rawState: 'RUN', stateMapped: true },
        },
      });
    });

    it('rejects an unmapped state token with the raw token (UNMAPPED_VALUE)', () => {
      const result = decode(
        {
          topic: `${UNIT}/state`,
          payload: { ...STATE, state: { name: 'FAULT', value: 9 } },
        },
        stateOverrides,
      );
      expectFailure(result, 'UNMAPPED_VALUE', '"FAULT"');
    });

    it('routes the availabilityTopic of any connection to the availability decoder', () => {
      const topic = 'proact/v1/HDPE/gateway/availability';
      const envelope = decodeOk({
        topic,
        payload: {
          schema_version: '1.0',
          state: 'OFFLINE',
          ts: '2026-10-11T06:09:59.000Z',
          boot_id: BOOT,
        },
        retained: true,
      });
      expect(envelope).toMatchObject({
        kind: 'state',
        sourceObjectId: topic,
        values: {
          state: { stateRef: topic, value: 'OFFLINE', sequence: null },
        },
        quality: { status: 'good' },
        sourceControls: {
          mqtt: { availability: true, piConnected: null, retained: true },
        },
      });
      expect(envelope.messageId).toMatch(
        /^sha256:[0-9a-f]{64}:2026-10-11T06:09:59\.000Z$/,
      );
    });

    it('uses seq_boot for an availability message that carries a seq', () => {
      const envelope = decodeOk({
        topic: 'proact/v1/HDPE/gateway/availability',
        payload: {
          schema_version: '1.0',
          state: 'ONLINE',
          ts: '2026-10-11T06:00:00.000Z',
          seq: 0,
          boot_id: BOOT,
          pi_connected: false,
        },
      });
      expect(envelope.messageId).toBe(
        `proact/v1/HDPE/gateway/availability:${BOOT}:0`,
      );
      expect(envelope.sourceControls?.mqtt).toMatchObject({
        availability: true,
        piConnected: false,
        sequence: 0,
      });
    });
  });
});
