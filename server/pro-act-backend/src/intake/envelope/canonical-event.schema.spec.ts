import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { CanonicalEnvelope } from './canonical-envelope';
import { CANONICAL_EVENT_SCHEMA } from './canonical-event.schema';
import {
  canonicalJson,
  payloadHash,
  validateEnvelope,
} from './envelope-validator';

const CONTRACTS = resolve(__dirname, '..', '..', '..', '..', '..', 'contracts');
const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8'));

/** Every key a typed envelope may carry; compile-time checked against `CanonicalEnvelope`. */
const ENVELOPE_KEYS: Record<keyof CanonicalEnvelope, true> = {
  schemaVersion: true,
  messageId: true,
  tenantId: true,
  connectionId: true,
  sourceType: true,
  sourceObjectId: true,
  sourceRevision: true,
  operation: true,
  kind: true,
  observedAt: true,
  receivedAt: true,
  startTime: true,
  endTime: true,
  sourceTimezone: true,
  location: true,
  values: true,
  quality: true,
  provenance: true,
  sourceControls: true,
  retraction: true,
};

function example(name: string): Record<string, unknown> {
  return readJson(resolve(CONTRACTS, 'examples', name)) as Record<
    string,
    unknown
  >;
}

describe('canonical event envelope (plan 1.5 step 1, spec §5.1)', () => {
  it('the checked copy equals contracts/canonical-event.schema.json', () => {
    const published = readJson(
      resolve(CONTRACTS, 'canonical-event.schema.json'),
    );
    expect(JSON.parse(JSON.stringify(CANONICAL_EVENT_SCHEMA))).toEqual(
      published,
    );
  });

  it('the TypeScript shape lists exactly the schema properties', () => {
    expect(Object.keys(ENVELOPE_KEYS).sort()).toEqual(
      Object.keys(CANONICAL_EVENT_SCHEMA.properties).sort(),
    );
  });

  it.each(readdirSync(resolve(CONTRACTS, 'examples')))(
    'example %s is valid',
    (name) => {
      const result = validateEnvelope(example(name));
      expect(result.valid ? [] : result.violations).toEqual([]);
    },
  );

  it('reports missing identity, bad times and unknown fields', () => {
    const envelope = example('pi-event-frame.json');
    delete envelope.messageId;
    envelope.observedAt = 'yesterday';
    envelope.extra = 1;

    const result = validateEnvelope(envelope);

    expect(result.valid).toBe(false);
    const paths = result.valid ? [] : result.violations.map((v) => v.path);
    expect(paths).toEqual(expect.arrayContaining(['/', '/observedAt']));
  });

  it('requires a start for interval kinds and a sample for measurements', () => {
    const interval = example('pi-event-frame.json');
    delete interval.startTime;
    const measurement = example('mqtt-measurement.json');
    delete measurement.values;

    expect(validateEnvelope(interval).valid).toBe(false);
    expect(validateEnvelope(measurement).valid).toBe(false);
  });

  it('a retraction must be a retract operation with a source revision key', () => {
    const retraction = example('retraction.json');
    retraction.operation = 'observe';
    const missingRevision = example('retraction.json');
    delete missingRevision.sourceRevision;

    expect(validateEnvelope(retraction).valid).toBe(false);
    expect(validateEnvelope(missingRevision).valid).toBe(false);
  });

  it('hashes canonical JSON independent of key order', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 3, c: undefined }] })).toBe(
      '{"a":[2,{"d":3}],"b":1}',
    );
    expect(payloadHash({ a: 1, b: 2 })).toBe(payloadHash({ b: 2, a: 1 }));
    expect(payloadHash({ a: 1 })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
