import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PAYLOAD_PROFILE_KINDS, PayloadProfileKind } from '../payload-profile';
import { contractFileOf, MQTT_MESSAGE_SCHEMAS } from './mqtt-message-schemas';
import {
  describeViolations,
  validateMqttMessage,
} from './mqtt-message-validator';

const BACKEND = resolve(__dirname, '..', '..', '..', '..', '..');
const CONTRACTS = resolve(BACKEND, '..', '..', 'contracts', 'mqtt');
const FIXTURES = resolve(BACKEND, 'test', 'fixtures', 'mqtt');

interface Fixture {
  id: string;
  profile: { kind: PayloadProfileKind };
  packet: { topic: string };
  payload: Record<string, unknown>;
}

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8'));

const fixtures = readdirSync(FIXTURES)
  .filter((file) => file.endsWith('.json'))
  .map((file) => readJson(resolve(FIXTURES, file)) as Fixture);

/** The contract kind of a fixture: the availability topic carries availability messages. */
function kindOf(fixture: Fixture): PayloadProfileKind {
  return fixture.packet.topic.endsWith('/gateway/availability')
    ? 'availability'
    : fixture.profile.kind;
}

function event(change: Record<string, unknown> = {}): Record<string, unknown> {
  const open = fixtures.find((fixture) => fixture.id === 'event-open');
  if (!open) throw new Error('fixture event-open is missing');
  const payload: Record<string, unknown> = { ...open.payload, ...change };
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) delete payload[key];
  }
  return payload;
}

describe('MQTT message contracts v1 (plan 1.8 WP3 step 2, OT contract §3)', () => {
  it('every checked copy equals its published contract and every contract has a copy', () => {
    const files = readdirSync(CONTRACTS).filter((f) => f.endsWith('.json'));
    expect(files.sort()).toEqual(
      PAYLOAD_PROFILE_KINDS.map(contractFileOf).sort(),
    );
    for (const kind of PAYLOAD_PROFILE_KINDS) {
      const published = readJson(resolve(CONTRACTS, contractFileOf(kind)));
      expect(JSON.parse(JSON.stringify(MQTT_MESSAGE_SCHEMAS[kind]))).toEqual(
        published,
      );
    }
  });

  it('every contract is draft 2020-12 and closed to unknown properties', () => {
    for (const schema of Object.values(MQTT_MESSAGE_SCHEMAS)) {
      expect(schema.$schema).toBe(
        'https://json-schema.org/draft/2020-12/schema',
      );
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required).toContain('schema_version');
      expect(schema.required).toContain('ts');
      expect(schema.required).toContain('boot_id');
    }
  });

  it.each(fixtures.map((fixture) => [fixture.id, fixture] as const))(
    'accepts the contract example %s',
    (_id, fixture) => {
      const violations = validateMqttMessage(kindOf(fixture), fixture.payload);
      expect(describeViolations(violations)).toBe('');
    },
  );

  it.each<[string, PayloadProfileKind, unknown]>([
    [
      'a missing schema_version',
      'interval_event_json',
      event({ schema_version: undefined }),
    ],
    [
      'a missing event_id',
      'interval_event_json',
      event({ event_id: undefined }),
    ],
    [
      'a local-time ts without offset',
      'interval_event_json',
      event({ ts: '2026-10-11T06:09:30.100' }),
    ],
    [
      'an end_ts in the year 9999 (PI sentinel)',
      'interval_event_json',
      event({ end_ts: '9999-12-31T23:59:59Z' }),
    ],
    [
      'an epoch-integer ts',
      'interval_event_json',
      event({ ts: 1791440400000 }),
    ],
    ['a root array', 'interval_event_json', [event()]],
    ['an extra property', 'interval_event_json', event({ tenant: 'acme' })],
    [
      'an upsert without start_ts',
      'interval_event_json',
      event({ start_ts: undefined }),
    ],
    [
      'an unknown operation',
      'interval_event_json',
      event({ operation: 'patch' }),
    ],
    [
      'a space-separated ts',
      'measurement_json',
      {
        schema_version: '1.0',
        signal: 's',
        value: 1,
        ts: '2026-10-11 06:07:14Z',
        seq: 1,
        boot_id: 'b',
      },
    ],
    [
      'a string measurement value',
      'measurement_json',
      {
        schema_version: '1.0',
        signal: 's',
        value: '12',
        ts: '2026-10-11T06:07:14Z',
        seq: 1,
        boot_id: 'b',
      },
    ],
    [
      'a negative seq',
      'measurement_json',
      {
        schema_version: '1.0',
        signal: 's',
        value: 1,
        ts: '2026-10-11T06:07:14Z',
        seq: -1,
        boot_id: 'b',
      },
    ],
    [
      'a state without a name',
      'state_json',
      {
        schema_version: '1.0',
        state: { value: 1 },
        ts: '2026-10-11T06:07:14Z',
        seq: 1,
        boot_id: 'b',
      },
    ],
    [
      'an availability state outside ONLINE | OFFLINE',
      'availability',
      {
        schema_version: '1.0',
        state: 'UP',
        ts: '2026-10-11T06:07:14Z',
        boot_id: 'b',
      },
    ],
    [
      'another schema version',
      'availability',
      {
        schema_version: '2.0',
        state: 'ONLINE',
        ts: '2026-10-11T06:07:14Z',
        boot_id: 'b',
      },
    ],
  ])('rejects %s', (_label, kind, payload) => {
    expect(validateMqttMessage(kind, payload)).not.toEqual([]);
  });

  it('accepts a delete with only the identity fields and an integer revision', () => {
    const violations = validateMqttMessage('interval_event_json', {
      schema_version: '1.0',
      event_id: 'EF-1',
      revision: 7,
      operation: 'delete',
      ts: '2026-10-11T06:09:30.100+02:00',
      seq: 9,
      boot_id: 'b',
    });
    expect(violations).toEqual([]);
  });

  it('accepts a string quality token and a boolean measurement value', () => {
    const violations = validateMqttMessage('measurement_json', {
      schema_version: '1.0',
      signal: 's',
      value: true,
      ts: '2026-10-11T06:07:14Z',
      quality: 'GOOD',
      seq: 1,
      boot_id: 'b',
    });
    expect(violations).toEqual([]);
  });

  it('reports storable violations with instance paths', () => {
    const violations = validateMqttMessage(
      'interval_event_json',
      event({ ts: 'yesterday', extra: 1 }),
    );
    expect(violations.map((v) => v.path)).toEqual(
      expect.arrayContaining(['/ts', '/']),
    );
    expect(describeViolations(violations)).toMatch(/^\/.* /);
  });
});
