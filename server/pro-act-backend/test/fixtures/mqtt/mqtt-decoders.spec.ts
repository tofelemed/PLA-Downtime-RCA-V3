import * as fs from 'fs';
import * as path from 'path';
import { CanonicalEnvelope } from '../../../src/intake/envelope/canonical-envelope';
import { validateEnvelope } from '../../../src/intake/envelope/envelope-validator';
import { DecodeResult } from '../../../src/intake/adapters/mqtt/decode-result';
import {
  exampleDecodeConnection,
  examplePacket,
} from '../../../src/intake/adapters/mqtt/mqtt-decode.example';
import { decodeMqttMessage } from '../../../src/intake/adapters/mqtt/profiles';
import {
  contentHashOf,
  decideOrdering,
  OrderingDecision,
  StoredVersion,
} from '../../../src/intake/source-object-ordering';

/**
 * Plan 1.8 WP3 step 2: every example message of `docs/MQTT_OT_CONTRACT.md` §3 decodes into a
 * canonical envelope that passes the intake contract, with the key fields the mapping study
 * (integration plan WP2 table) expects. Retained re-sends and out-of-order revisions are proven
 * through the same ordering rule intake applies (`decideOrdering`), not by a second implementation.
 */
interface MqttFixture {
  id: string;
  title: string;
  profile: Record<string, unknown>;
  topics: string[];
  packet: {
    topic: string;
    retained: boolean;
    qos: 0 | 1 | 2;
    dup: boolean;
    packetId: number;
  };
  receivedAt: string;
  payload: Record<string, unknown>;
  expect:
    | { ok: true; envelope: Record<string, unknown> }
    | { ok: false; code: string };
  ordering?: { after: string; decision: OrderingDecision };
  sameMessageIdAs?: string;
  messageIdPattern?: string;
}

const FIXTURE_DIR = path.join(__dirname);
const fixtures = fs
  .readdirSync(FIXTURE_DIR)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map(
    (file) =>
      JSON.parse(
        fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8'),
      ) as MqttFixture,
  );

function fixtureOf(id: string): MqttFixture {
  const fixture = fixtures.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`fixture ${id} is missing`);
  return fixture;
}

function decode(fixture: MqttFixture): DecodeResult {
  const connection = exampleDecodeConnection({
    mqtt: { topics: fixture.topics },
    payloadProfile: fixture.profile,
  });
  return decodeMqttMessage(
    examplePacket(
      {
        ...fixture.packet,
        payload: fixture.payload,
        receivedAt: fixture.receivedAt,
      },
      connection,
    ),
  );
}

function envelopeOf(fixture: MqttFixture): CanonicalEnvelope {
  const result = decode(fixture);
  if (!result.ok)
    throw new Error(`${fixture.id}: ${result.code} ${result.detail}`);
  return result.envelope;
}

function versionOf(envelope: CanonicalEnvelope): StoredVersion {
  return {
    hash: contentHashOf(envelope),
    observedAt: new Date(envelope.observedAt),
    revision: envelope.sourceRevision ?? null,
  };
}

describe('MQTT contract fixtures (plan 1.8 WP3 step 2)', () => {
  it('covers every message family of the contract', () => {
    const ids = fixtures.map((fixture) => fixture.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'event-open',
        'event-closed',
        'event-update-end',
        'event-delete',
        'event-retained-duplicate',
        'event-revision-out-of-order',
        'measurement-numeric',
        'measurement-digital',
        'state-run',
        'state-stop',
        'state-run-retained-duplicate',
        'availability-online',
        'availability-offline-lwt',
      ]),
    );
  });

  describe.each(fixtures.map((fixture) => [fixture.id, fixture] as const))(
    '%s',
    (_id, fixture) => {
      it(fixture.title, () => {
        const result = decode(fixture);
        if (!fixture.expect.ok) {
          expect(result).toMatchObject({
            ok: false,
            code: fixture.expect.code,
          });
          return;
        }
        if (!result.ok) throw new Error(`${result.code}: ${result.detail}`);
        expect(result.envelope).toMatchObject(fixture.expect.envelope);
        expect(result.envelope).toMatchObject({
          tenantId: exampleDecodeConnection().tenantId,
          connectionId: exampleDecodeConnection().connectionId,
          sourceType: 'mqtt',
          receivedAt: fixture.receivedAt,
          provenance: { rawPayload: fixture.payload },
          sourceControls: {
            mqtt: {
              topic: fixture.packet.topic,
              retained: fixture.packet.retained,
              duplicate: fixture.packet.dup,
              qos: fixture.packet.qos,
              packetId: fixture.packet.packetId,
            },
          },
        });
        if (fixture.messageIdPattern) {
          expect(result.envelope.messageId).toMatch(
            new RegExp(fixture.messageIdPattern),
          );
        }
      });

      it('produces an envelope that passes the canonical contract', () => {
        const validation = validateEnvelope(envelopeOf(fixture));
        expect(validation.valid ? [] : validation.violations).toEqual([]);
      });

      if (fixture.sameMessageIdAs) {
        it(`is a redelivery of ${fixture.sameMessageIdAs} (same message id, no new business effect)`, () => {
          const first = envelopeOf(
            fixtureOf(fixture.sameMessageIdAs as string),
          );
          const again = envelopeOf(fixture);
          expect(again.messageId).toBe(first.messageId);
          expect(again.sourceObjectId).toBe(first.sourceObjectId);
          expect(again.observedAt).toBe(first.observedAt);
        });
      }

      if (fixture.ordering) {
        const { after, decision } = fixture.ordering;
        it(`arriving after ${after} is ordered as ${decision}`, () => {
          const stored = versionOf(envelopeOf(fixtureOf(after)));
          const incoming = versionOf(envelopeOf(fixture));
          expect(decideOrdering(stored, incoming)).toBe(decision);
        });
      }
    },
  );
});
