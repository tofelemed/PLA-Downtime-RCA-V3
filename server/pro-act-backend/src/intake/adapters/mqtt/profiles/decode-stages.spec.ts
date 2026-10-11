import { DecodeInput } from '../decode-result';
import { exampleDecodeConnection, examplePacket } from '../mqtt-decode.example';
import { decodeMqttMessage, PROFILE_DECODERS } from './index';
import {
  decode,
  decodeOk,
  EVENT,
  events,
  expectFailure,
  MEASUREMENT_PROFILE,
  MEASUREMENT_TOPICS,
  SAMPLE,
  UNIT,
} from './decode-spec-support';

describe('MQTT decode stages shared by every profile (plan 1.8 WP3 step 2, design §4.2 stages 2–4, 9)', () => {
  it('registers one decoder per profile kind', () => {
    expect(Object.keys(PROFILE_DECODERS).sort()).toEqual([
      'availability',
      'interval_event_json',
      'measurement_json',
      'state_json',
    ]);
    for (const [kind, decoder] of Object.entries(PROFILE_DECODERS)) {
      expect(decoder.kind).toBe(kind);
    }
  });

  describe('shared stages, in order', () => {
    it('TOPIC_NOT_ALLOWED: a topic outside the allowlist is rejected before anything is parsed', () => {
      const result = decode({
        topic: 'other/v1/x/events',
        payload: 'not even json',
      });
      expectFailure(
        result,
        'TOPIC_NOT_ALLOWED',
        'matches no configured topic filter',
      );
      if (!result.ok) expect(result.rawPayloadRef?.json).toBeUndefined();
    });

    it('TOO_LARGE: payload above maxMessageBytes', () => {
      const result = decode(events(EVENT), { mqtt: { maxMessageBytes: 64 } });
      expectFailure(result, 'TOO_LARGE', 'limit 64');
    });

    it.each([
      ['text', 'nope'],
      ['a root array', '[1, 2]'],
      ['a string', '"s"'],
      ['null', 'null'],
      ['empty', ''],
    ])('NOT_JSON: %s', (_label, payload) => {
      expectFailure(decode(events(payload)), 'NOT_JSON');
    });

    it('UNSUPPORTED_VERSION: missing, unknown or not the profile version', () => {
      expectFailure(
        decode(events({ ...EVENT, schema_version: undefined })),
        'UNSUPPORTED_VERSION',
        'missing',
      );
      expectFailure(
        decode(events({ ...EVENT, schema_version: '2.0' })),
        'UNSUPPORTED_VERSION',
        '2.0',
      );
      expectFailure(
        decode(events(EVENT), { payloadProfile: { schemaVersion: '1.1' } }),
        'UNSUPPORTED_VERSION',
        "profile's 1.1",
      );
    });

    it('TOPIC_SHAPE: level count and literal case must match the template', () => {
      const wide = { mqtt: { topics: ['proact/#'] } };
      expectFailure(
        decode({ topic: 'proact/v1/HDPE/events', payload: EVENT }, wide),
        'TOPIC_SHAPE',
        'levels',
      );
      expectFailure(
        decode(
          {
            topic: 'proact/V1/HDPE/Polymer/Line1/Extruder1/events',
            payload: EVENT,
          },
          wide,
        ),
        'TOPIC_SHAPE',
        'expects "v1"',
      );
    });

    it('SCHEMA_INVALID: contract violations are reported with their paths and the parsed payload is kept', () => {
      const result = decode(
        events({ ...EVENT, event_id: undefined, extra: 1 }),
      );
      expectFailure(result, 'SCHEMA_INVALID', 'event_id');
      if (!result.ok) {
        expect(result.rawPayloadRef).toMatchObject({
          topic: `${UNIT}/events`,
          payloadHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) as string,
          json: expect.objectContaining({ extra: 1 }) as object,
        });
      }
      expectFailure(
        decode(events({ ...EVENT, ts: '2026-10-11T06:09:30.100' })),
        'SCHEMA_INVALID',
        '/ts',
      );
      expectFailure(
        decode(events({ ...EVENT, end_ts: '9999-12-31T23:59:59Z' })),
        'SCHEMA_INVALID',
        '/end_ts',
      );
    });

    it('IDENTITY_MISMATCH: a site claim that contradicts the connection is refused, a matching one is never used', () => {
      const tenancy = { payloadProfile: { tenancy: { expectedSite: 'HDPE' } } };
      expect(decodeOk(events(EVENT), tenancy).tenantId).toBe(
        exampleDecodeConnection().tenantId,
      );
      expectFailure(
        decode(
          {
            topic: 'proact/v1/LDPE/Polymer/Line1/Extruder1/events',
            payload: EVENT,
          },
          tenancy,
        ),
        'IDENTITY_MISMATCH',
        'site claim "LDPE"',
      );
      expectFailure(
        decode(events(EVENT), {
          payloadProfile: {
            tenancy: { expectedTenantClaim: 'acme' },
            fields: { tenant: 'source' },
          },
        }),
        'IDENTITY_MISMATCH',
        'tenant claim "gw"',
      );
    });

    it('FUTURE_TIMESTAMP: ts more than 300 s ahead of the receive time', () => {
      expectFailure(
        decode(events({ ...EVENT, ts: '2026-10-11T06:20:00.000Z' })),
        'FUTURE_TIMESTAMP',
      );
      expect(
        decodeOk(events({ ...EVENT, ts: '2026-10-11T06:14:00.000Z' }))
          .observedAt,
      ).toBe('2026-10-11T06:14:00.000Z');
    });

    it('STALE_TIMESTAMP: events reject by default, samples flag by default, both configurable', () => {
      const old = '2026-10-02T06:00:00.000Z';
      expectFailure(decode(events({ ...EVENT, ts: old })), 'STALE_TIMESTAMP');
      const flagged = decodeOk(events({ ...EVENT, ts: old }), {
        payloadProfile: { time: { onStale: 'flag' } },
      });
      expect(flagged.quality).toMatchObject({
        degraded: true,
        sourceFlags: ['stale'],
      });
      const sample = decodeOk(
        {
          topic: `${UNIT}/measurements/Throughput`,
          payload: { ...SAMPLE, ts: old },
        },
        {
          mqtt: { topics: MEASUREMENT_TOPICS },
          payloadProfile: MEASUREMENT_PROFILE,
        },
      );
      expect(sample.quality).toMatchObject({
        status: 'good',
        degraded: true,
        sourceFlags: ['stale'],
      });
      expectFailure(
        decode(
          {
            topic: `${UNIT}/measurements/Throughput`,
            payload: { ...SAMPLE, ts: old },
          },
          {
            mqtt: { topics: MEASUREMENT_TOPICS },
            payloadProfile: {
              ...MEASUREMENT_PROFILE,
              time: { onStale: 'reject' },
            },
          },
        ),
        'STALE_TIMESTAMP',
      );
    });
  });

  it('takes an explicit correlation id and never a tenant from the message', () => {
    const input: DecodeInput = examplePacket(
      events(EVENT, { correlationId: 'replay:1' }),
    );
    const result = decodeMqttMessage(input);
    expect(result.ok && result.envelope.provenance.correlationId).toBe(
      'replay:1',
    );
    expect(result.ok && result.envelope.connectionId).toBe(
      input.connection.connectionId,
    );
  });
});
