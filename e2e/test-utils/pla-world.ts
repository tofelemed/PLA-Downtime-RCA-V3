import { randomUUID } from 'node:crypto';
import { call, command } from './downtime-world';
import { reconciliation, saveLines, seedDashboardWorld, type DashboardWorld } from './dashboard-world';

/**
 * Seeds the plan 3.6 e2e through the API (new "E2E …" units / products only; nothing existing changes):
 * the 3.5 dashboard world (unit "E2E PD …", one operational day three days ago, three 1000 t shifts with
 * 850 t each, 1 h stops in shifts A and B), with shift A reconciled (accept 90 t + manual 60 t), submitted
 * by the engineer and approved by the manager; plus a unit "E2E PLA T41 …" whose calendar excludes the
 * whole day (no scheduled time) and 0 t output per shift, recalculated, for the T41 OEE tile.
 */
const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface PlaWorld {
  dashboard: DashboardWorld;
  /** the whole operational day (three periods) */
  day: { from: string; to: string };
  /** shift A only (approved) */
  shiftA: { from: string; to: string };
  t41: { unitId: string; unitName: string };
}

async function ok<T>(pending: Promise<{ status: number; body: T }>, what: string): Promise<T> {
  const result = await pending;
  if (result.status >= 300) throw new Error(`${what}: ${result.status} ${JSON.stringify(result.body)}`);
  return result.body;
}

async function approveShiftA(engineer: string, manager: string, world: DashboardWorld): Promise<void> {
  await saveLines(engineer, world.periods.a, world.reasonCodeId, ['60']);
  const view = await reconciliation(engineer, world.periods.a);
  await ok(command(engineer, `/v2/production-periods/${world.periods.a}/submit`, { revision: view.revision.revision, runId: view.baseRunId, contentHash: view.contentHash }), 'submit A');
  const submitted = await call<{ revision: { revision: number; submittedHash: string } }>(manager, 'GET', `/v2/production-periods/${world.periods.a}/reconciliation`);
  const { revision, submittedHash } = submitted.body.revision;
  await ok(command(manager, `/v2/production-periods/${world.periods.a}/approve`, { revision, submittedHash }), 'approve A');
}

async function excludedDayUnit(token: string, tenantId: string, dayStart: number) {
  const suffix = randomUUID().slice(0, 8);
  const unitName = `E2E PLA T41 ${suffix}`;
  const { id: unitId } = await ok(call<{ id: string }>(token, 'POST', '/units', { name: unitName, code: `E2E-PLA-${suffix}`, tenantId }), 'unit');
  const effectiveFrom = new Date(dayStart - 6 * DAY).toISOString().slice(0, 10);
  const { id: calendar } = await ok(
    command<{ id: string }>(token, '/v2/calendar-versions', {
      unitId,
      timezone: 'UTC',
      operationalDayStart: '06:00',
      shiftTemplates: [
        { name: 'A', startLocal: '06:00', endLocal: '14:00' },
        { name: 'B', startLocal: '14:00', endLocal: '22:00' },
        { name: 'C', startLocal: '22:00', endLocal: '06:00' },
      ],
      exclusions: [{ from: new Date(dayStart).toISOString(), to: new Date(dayStart + DAY).toISOString(), reason: 'E2E no demand', kind: 'no_demand' }],
      effectiveFrom,
    }),
    'calendar',
  );
  await ok(command(token, `/v2/calendar-versions/${calendar}/publish`, {}), 'publish');
  const { id: productId } = await ok(call<{ id: string }>(token, 'POST', '/products', { name: `E2E PLA product ${suffix}`, code: `E2E-PLAP-${suffix}`, tenantId }), 'product');
  const { id: profileId } = await ok(command<{ id: string }>(token, '/v2/profiles', { unitId, productId, quantityUom: 't', rateTimebase: 'h', effectiveFrom: `${effectiveFrom}T00:00:00Z` }), 'profile');
  await ok(command(token, `/v2/profiles/${profileId}/approve`, {}), 'approve profile');
  const window = { unitIds: [unitId], from: new Date(dayStart).toISOString(), to: new Date(dayStart + DAY).toISOString() };
  await ok(command(token, '/v2/production-periods/materialize', window), 'materialize');
  for (const shift of [0, 8, 16]) {
    // output is known (0 t): the only reason left for a missing OEE is the missing scheduled time
    const start = dayStart + shift * HOUR;
    const output = { unitId, startTime: new Date(start).toISOString(), endTime: new Date(start + 8 * HOUR).toISOString(), physicalType: 'production_output', eventType: 'ProductionOutput', quantity: '0', quantityUom: 't' };
    await ok(command(token, '/v2/production-events', output), 'output');
  }
  await ok(command(token, '/v2/production-periods/recalculate', window), 'recalculate');
  return { unitId, unitName };
}

async function until(what: string, probe: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 90; i += 1) {
    if (await probe()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`timed out waiting for ${what}`);
}

export async function seedPlaWorld(manager: string, engineer: string, tenantId: string): Promise<PlaWorld> {
  const dashboard = await seedDashboardWorld(manager, tenantId);
  await approveShiftA(engineer, manager, dashboard);
  const t41 = await excludedDayUnit(manager, tenantId, dashboard.dayStart);
  const day = { from: new Date(dashboard.dayStart).toISOString(), to: new Date(dashboard.dayStart + DAY).toISOString() };
  await until('T41 unit calculated', async () => {
    const query = `unitIds=${t41.unitId}&from=${encodeURIComponent(day.from)}&to=${encodeURIComponent(day.to)}&groupBy=unit`;
    const report = await call<{ data?: { calculationRunIds: string[] } }>(manager, 'GET', `/v2/reports/oee?${query}`);
    return (report.body.data?.calculationRunIds.length ?? 0) > 0;
  });
  return { dashboard, day, shiftA: { from: day.from, to: new Date(dashboard.dayStart + 8 * HOUR).toISOString() }, t41 };
}

/** `/pla-analytics` (or another page) URL of a unit and window. */
export function scopeUrl(path: string, unitIds: string[], window: { from: string; to: string }, extra = ''): string {
  return `${path}?from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}&window=E2E&units=${unitIds.join(',')}${extra}`;
}
