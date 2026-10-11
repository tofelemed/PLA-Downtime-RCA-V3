import { CanonicalEnvelope } from '../../../envelope/canonical-envelope';
import { validateEnvelope } from '../../../envelope/envelope-validator';
import { DecodeFailureCode, DecodeResult } from '../decode-result';
import {
  exampleDecodeConnection,
  examplePacket,
  ExamplePacket,
} from '../mqtt-decode.example';
import { decodeMqttMessage } from './index';

/** Shared inputs and assertions of the decoder specs (`decode-stages.spec.ts`, `profiles.spec.ts`). */
export type Overrides = Parameters<typeof exampleDecodeConnection>[0];

export const UNIT = 'proact/v1/HDPE/Polymer/Line1/Extruder1';
export const BOOT = 'gw-01-2026-10-11T05:00:00Z';
export const EVENT = {
  schema_version: '1.0',
  event_id: 'EF-1',
  revision: '2026-10-11T06:09:30.000Z',
  operation: 'upsert',
  template: 'Production Loss',
  element_path: '\\\\PIAF\\HDPE\\Polymer\\Line1\\Extruder1',
  start_ts: '2026-10-11T05:40:00.000Z',
  end_ts: null,
  attributes: { 'Reason Code': 'MECH-01', Quantity: 2 },
  ts: '2026-10-11T06:09:30.100Z',
  seq: 1844,
  boot_id: BOOT,
  source: 'gw',
};
export const MEASUREMENT_PROFILE = {
  kind: 'measurement_json',
  topicTemplate:
    'proact/v1/{site}/{area}/{line}/{unit}/measurements/{attribute}',
  identityStrategy: 'seq_boot',
};
export const MEASUREMENT_TOPICS = ['proact/v1/+/+/+/+/measurements/#'];
export const SAMPLE = {
  schema_version: '1.0',
  signal: 'F1DP-throughput',
  value: 12.5,
  uom: 't/h',
  ts: '2026-10-11T06:07:14.187Z',
  quality: { good: true },
  seq: 42,
  boot_id: BOOT,
};
export const STATE_PROFILE = {
  kind: 'state_json',
  topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/state',
  identityStrategy: 'seq_boot',
  valueMaps: { state: { RUN: 'running', STOP: 'stopped' } },
};
export const STATE = {
  schema_version: '1.0',
  state: { name: 'RUN', value: 1 },
  ts: '2026-10-11T06:07:14.187Z',
  quality: { good: true },
  seq: 7,
  boot_id: BOOT,
};

export function decode(
  packet: ExamplePacket,
  overrides: Overrides = {},
): DecodeResult {
  return decodeMqttMessage(
    examplePacket(packet, exampleDecodeConnection(overrides)),
  );
}

/** Decodes and proves the envelope passes the canonical contract. */
export function decodeOk(
  packet: ExamplePacket,
  overrides: Overrides = {},
): CanonicalEnvelope {
  const result = decode(packet, overrides);
  if (!result.ok) throw new Error(`${result.code}: ${result.detail}`);
  const validation = validateEnvelope(result.envelope);
  expect(validation.valid ? [] : validation.violations).toEqual([]);
  return result.envelope;
}

export function expectFailure(
  result: DecodeResult,
  code: DecodeFailureCode,
  fragment?: string,
): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.code).toBe(code);
  if (fragment) expect(result.detail).toContain(fragment);
}

export const events = (
  payload: unknown,
  packet: Partial<ExamplePacket> = {},
): ExamplePacket => ({
  topic: `${UNIT}/events`,
  payload,
  ...packet,
});
