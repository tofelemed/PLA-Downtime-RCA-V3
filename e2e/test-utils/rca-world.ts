import { randomUUID } from 'node:crypto';
import { call, command } from './downtime-world';

/**
 * Plan 3.9 world: a new unit "E2E RCA …" of the demo tenant with one running unplanned stop that started
 * 130 minutes ago (past the D17 2 h threshold, SME 2026-10-14), created through the v2 API; the trigger service
 * records its provisional recommendation through the outbox. Everything is new "E2E …" data.
 */
export interface RcaWorld {
  suffix: string;
  unitId: string;
  unitName: string;
  stopId: string;
  description: string;
}

const MINUTE = 60_000;

export async function seedRcaWorld(manager: string, tenantId: string): Promise<RcaWorld> {
  const suffix = randomUUID().slice(0, 8);
  const unitName = `E2E RCA ${suffix}`;
  const unit = await call<{ id: string }>(manager, 'POST', '/units', { name: unitName, code: `E2E-RCA-${suffix}`, tenantId });
  if (unit.status !== 201 && unit.status !== 200) throw new Error(`unit: ${unit.status} ${JSON.stringify(unit.body)}`);
  const description = `E2E RCA stop ${suffix}`;
  const stop = await command<{ id: string }>(manager, '/v2/production-events', {
    unitId: unit.body.id,
    eventType: 'ProductionLoss',
    physicalType: 'downtime',
    scheduleClass: 'unplanned',
    startTime: new Date(Date.now() - 130 * MINUTE).toISOString(),
    description,
  });
  if (stop.status !== 201) throw new Error(`stop: ${stop.status} ${JSON.stringify(stop.body)}`);
  return { suffix, unitId: unit.body.id, unitName, stopId: stop.body.id, description };
}

export interface RecommendationBody {
  id: string;
  trigger: string;
  provisional: boolean;
  state: string;
}

/** Waits until the outbox relay delivered the event to the trigger service (relay runs every second). */
export async function waitForRecommendation(token: string, eventId: string): Promise<RecommendationBody> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await call<{ items: RecommendationBody[] }>(token, 'GET', `/v2/rca-recommendations?eventIds=${eventId}`);
    if (result.status === 200 && result.body.items.length > 0) return result.body.items[0];
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`no recommendation for ${eventId}`);
}
