import { DecodeConnection, DecodeInput } from './decode-result';
import { parseMqttConfig } from './mqtt-config';
import { exampleMqttConfig } from './mqtt-config.example';

/**
 * Reference inputs of the decoding layer (plan 1.8 WP3 step 2) for the unit specs and the fixture
 * suite under `test/fixtures/mqtt`: a decode connection built from `exampleMqttConfig` and a packet
 * as mqtt.js would hand it over. Deep-copied on every call.
 */
export const EXAMPLE_TENANT_ID = '0b5a6f3e-2d4c-4b8a-9e1f-7c6d5e4f3a2b';
export const EXAMPLE_CONNECTION_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
export const EXAMPLE_RECEIVED_AT = '2026-10-11T06:10:00.000Z';

type ConfigOverrides = Parameters<typeof exampleMqttConfig>[0];

export function exampleDecodeConnection(
  overrides: ConfigOverrides = {},
  configVersion = 3,
): DecodeConnection {
  return {
    tenantId: EXAMPLE_TENANT_ID,
    connectionId: EXAMPLE_CONNECTION_ID,
    configVersion,
    config: parseMqttConfig(exampleMqttConfig(overrides)),
  };
}

export interface ExamplePacket {
  topic: string;
  /** an object is JSON-encoded; a string or Buffer is sent as is */
  payload: unknown;
  retained?: boolean;
  qos?: 0 | 1 | 2;
  dup?: boolean;
  packetId?: number | null;
  receivedAt?: string;
  correlationId?: string;
}

export function examplePacket(
  packet: ExamplePacket,
  connection: DecodeConnection = exampleDecodeConnection(),
): DecodeInput {
  return {
    topic: packet.topic,
    payload: bufferOf(packet.payload),
    retained: packet.retained ?? false,
    qos: packet.qos ?? 1,
    dup: packet.dup ?? false,
    packetId: packet.packetId ?? 41,
    receivedAt: new Date(packet.receivedAt ?? EXAMPLE_RECEIVED_AT),
    ...(packet.correlationId ? { correlationId: packet.correlationId } : {}),
    connection,
  };
}

function bufferOf(payload: unknown): Buffer {
  if (Buffer.isBuffer(payload)) return payload;
  if (typeof payload === 'string') return Buffer.from(payload, 'utf8');
  return Buffer.from(JSON.stringify(payload), 'utf8');
}
