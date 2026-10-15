import { type ChildProcess } from 'node:child_process';
import { authenticate } from '../../test-utils/api-helpers';
import { call } from '../../test-utils/downtime-world';
import { PREFIX } from './integration-world';
import { startPiSimulator } from '../../test-utils/pi-simulator';

/**
 * UX06 world of the integration admin persona: the backend's PI Web API test simulator (fake account,
 * never a real PI server) as a child process on an ephemeral port the API reaches (see `pi-simulator.ts`: `E2E_PI_SIM_HOST` for a Docker API), with
 * one AF element and two "Production Loss" frames of 15 min ("00:15:00"): one 90 min ago (limited job)
 * and one 3 days ago (only the 7-day backfill reads it). A new unit `P-INT-PI-…` is the binding target;
 * the v1 units API refuses master data to an integration admin, so the unit is created by the demo
 * manager approver (setup only, never through the UI). Nothing is deleted afterwards; the simulator
 * process stops with the spec (it is a process, not data), so the production job created in the journey
 * reports its endpoint unreachable once the run is over.
 */
const SETUP_MANAGER = { email: 'manager@acme.com', password: 'demo123' };

export interface PiWorld {
  suffix: string;
  simulator: ChildProcess;
  baseUrl: string;
  username: string;
  password: string;
  unitId: string;
  unitName: string;
  connectionName: string;
  elementPath: string;
  recentFrame: string;
  oldFrame: string;
}

/** The unit as the persona if the API lets it, else as the demo manager approver (setup only). */
async function createUnit(personaToken: string, tenantId: string, suffix: string): Promise<{ id: string; name: string }> {
  const name = `${PREFIX}PI-${suffix}`;
  const body = { name, code: `${PREFIX}PI-${suffix}`, tenantId };
  const own = await call<{ id: string }>(personaToken, 'POST', '/units', body);
  if (own.status === 201 || own.status === 200) return { id: own.body.id, name };
  const manager = await authenticate(SETUP_MANAGER.email, SETUP_MANAGER.password);
  const unit = await call<{ id: string }>(manager.accessToken, 'POST', '/units', body);
  if (unit.status !== 201 && unit.status !== 200) throw new Error(`unit: ${unit.status} ${JSON.stringify(unit.body)}`);
  return { id: unit.body.id, name };
}

export async function seedPiWorld(personaToken: string, tenantId: string, suffix: string): Promise<PiWorld> {
  const elementPath = `\\\\SIM-AF\\HDPE\\P-INT\\Line-${suffix}`;
  const elementWebId = `EL-P-INT-${suffix}`;
  const recentFrame = `EF-P-INT-${suffix}-recent`;
  const oldFrame = `EF-P-INT-${suffix}-old`;
  const attributes = { Duration: '00:15:00', Quantity: 3, Description: `${PREFIX}PI stop ${suffix}` };
  const { child, ready } = await startPiSimulator({
    elements: [{ path: elementPath, webId: elementWebId }],
    frames: [
      { webId: recentFrame, startMinutesAgo: 90, endMinutesAgo: 75, elementWebId, attributes },
      { webId: oldFrame, startMinutesAgo: 3 * 1440, endMinutesAgo: 3 * 1440 - 15, elementWebId, attributes },
    ],
  });
  const unit = await createUnit(personaToken, tenantId, suffix);
  return { suffix, simulator: child, ...ready, unitId: unit.id, unitName: unit.name, connectionName: `${PREFIX}PI-${suffix}`, elementPath, recentFrame, oldFrame };
}

/** Stops only the simulator process; every connection, job, mapping and event stays. */
export function stopSimulator(world: PiWorld | undefined): void {
  if (!world) return;
  world.simulator.stdin?.end();
  world.simulator.kill();
}
