/**
 * Shared pieces of the simulator scenarios (`sim-scenarios.ts`, `sim-event-scenarios.ts`): the scenario
 * contract, flag readers and the one publish helper that logs delivery facts, never payloads.
 */
import { Logger } from '@nestjs/common';
import { MqttClient } from 'mqtt';
import {
  AttributeNames,
  Equipment,
  SimIdentity,
  SimTopics,
} from './sim-messages';

export type Flags = Record<string, string | true>;

export interface ScenarioContext {
  client: MqttClient;
  ids: SimIdentity;
  topics: SimTopics;
  equipment: Equipment;
  attributeNames: AttributeNames;
  flags: Flags;
  logger: Logger;
}

export interface Scenario {
  name: string;
  usage: string;
  run(ctx: ScenarioContext): Promise<void>;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function numberFlag(
  flags: Flags,
  key: string,
  fallback: number,
): number {
  const raw = flags[key];
  if (raw === undefined || raw === true) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`--${key} must be a non-negative number, got "${raw}"`);
  }
  return value;
}

export function stringFlagOr(
  flags: Flags,
  key: string,
  fallback: string,
): string {
  const raw = flags[key];
  return typeof raw === 'string' ? raw : fallback;
}

/** Publishes at QoS 1 and logs the delivery facts (topic, seq, size), never a whole payload. */
export async function publish(
  ctx: ScenarioContext,
  topic: string,
  payload: Record<string, unknown> | string,
  note: string,
  retain = false,
): Promise<void> {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  await ctx.client.publishAsync(topic, body, { qos: 1, retain });
  const seq =
    typeof payload !== 'string' && typeof payload.seq === 'number'
      ? String(payload.seq)
      : '-';
  const flag = retain ? 'RETAINED ' : '';
  ctx.logger.log(
    `${flag}${topic} seq=${seq} bytes=${Buffer.byteLength(body)} ${note}`,
  );
}

export function eventNote(
  message: Record<string, unknown>,
  expectation: string,
): string {
  return `event_id=${String(message.event_id)} revision=${String(message.revision)} -> ${expectation}`;
}
