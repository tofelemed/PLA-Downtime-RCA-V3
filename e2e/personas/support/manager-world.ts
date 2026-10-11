import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { api, created, itemsOf, ok, post, until } from './manager-api';
import { PREFIX, shortId, utcDate } from './manager-users';

/**
 * Worlds of the manager persona, seeded through the API with `P-MGR-` names (the patterns of
 * e2e/test-utils/dashboard-world.ts and downtime-world.ts, never their "E2E" data): nothing existing is
 * changed and nothing is ever deleted. A world is cached for the day in test-results/ so the later
 * persona specs (analytics) read the same plan the earlier ones (periods) approved.
 */
const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;
// not under test-results/: Playwright empties that folder at the start of every run (other personas run concurrently)
const CACHE_DIR = join(tmpdir(), 'proact-persona-worlds');

export interface PlanningUnit {
  unitId: string;
  unitName: string;
  unitCode: string;
  productId: string;
  productName: string;
  productCode: string;
  profileId: string | null;
}

export async function unitOf(token: string, tenantId: string, kind: string, suffix: string): Promise<{ unitId: string; unitName: string; unitCode: string }> {
  const unitName = `${PREFIX}${kind} ${suffix}`;
  const unitCode = `${PREFIX}${kind}-${suffix}`;
  const unitId = await created(api(token, 'POST', '/units', { name: unitName, code: unitCode, tenantId }), `${kind} unit`);
  return { unitId, unitName, unitCode };
}

export async function publishedCalendar(token: string, unitId: string, effectiveFrom: string, exclusions?: unknown[]): Promise<string> {
  const id = await created(
    post(token, '/v2/calendar-versions', {
      unitId,
      timezone: 'UTC',
      operationalDayStart: '06:00',
      shiftTemplates: [
        { name: 'A', startLocal: '06:00', endLocal: '14:00' },
        { name: 'B', startLocal: '14:00', endLocal: '22:00' },
        { name: 'C', startLocal: '22:00', endLocal: '06:00' },
      ],
      ...(exclusions ? { exclusions } : {}),
      effectiveFrom,
    }),
    'calendar',
  );
  await ok(post(token, `/v2/calendar-versions/${id}/publish`, {}), 'publish calendar');
  return id;
}

async function approvedProfile(token: string, unitId: string, productId: string, from: string): Promise<string> {
  const profileId = await created(post(token, '/v2/profiles', { unitId, productId, quantityUom: 't', rateTimebase: 'h', effectiveFrom: from }), 'profile');
  await ok(post(token, `/v2/profiles/${profileId}/approve`, {}), 'approve profile');
  for (const [rateKind, rate] of [['planning', '90'], ['sustained', '100']]) {
    const rateId = await created(post(token, `/v2/profiles/${profileId}/rates`, { rateKind, rate, timebase: 'h', effectiveFrom: from }), `${rateKind} rate`);
    await ok(post(token, `/v2/rates/${rateId}/approve`, {}), `approve ${rateKind}`);
  }
  return profileId;
}

/** A unit with a published UTC calendar (3 × 8 h from six days ago), a product and — unless `bare` — an approved profile (90 / 100 t/h). */
export async function seedPlanningUnit(token: string, tenantId: string, kind: string, options: { bare?: boolean } = {}): Promise<PlanningUnit> {
  const suffix = shortId();
  const unit = await unitOf(token, tenantId, kind, suffix);
  const productName = `${PREFIX}product ${suffix}`;
  const productCode = `${PREFIX}P-${suffix}`;
  const productId = await created(api(token, 'POST', '/products', { name: productName, code: productCode, tenantId }), 'product');
  if (options.bare) return { ...unit, productId, productName, productCode, profileId: null };
  await publishedCalendar(token, unit.unitId, utcDate(-6));
  const profileId = await approvedProfile(token, unit.unitId, productId, `${utcDate(-10)}T00:00:00Z`);
  return { ...unit, productId, productName, productCode, profileId };
}

export interface PeriodWorld {
  suffix: string;
  unitId: string;
  unitName: string;
  productId: string;
  planId: string;
  planName: string;
  reasonCodeId: string;
  periods: { a: string; b: string; c: string };
  stops: { a: string; b: string };
  dayStart: number;
  day: { from: string; to: string };
}

async function approvedPlan(token: string, unit: PlanningUnit, suffix: string, dayStart: number): Promise<{ planId: string; planName: string }> {
  const planName = `${PREFIX}PD plan ${suffix}`;
  const body = { name: planName, unitId: unit.unitId, validFrom: new Date(dayStart).toISOString(), validTo: new Date(dayStart + DAY).toISOString(), basis: 'quantity', headerTarget: '3000', slices: [{ productId: unit.productId }] };
  const planId = await created(post(token, '/v2/production-plans', body), 'plan');
  const jobId = await created(post(token, `/v2/production-plans/${planId}/generate-periods`, { version: 1 }), 'generate');
  await until('plan generation', async () => {
    const job = await api<{ state: string }>(token, 'GET', `/v2/plan-generation-jobs/${jobId}`);
    if (job.body.state === 'failed') throw new Error(`generation failed: ${JSON.stringify(job.body)}`);
    return job.body.state === 'completed' ? true : null;
  });
  await ok(post(token, `/v2/production-plans/${planId}/approve`, { expectedVersion: 1 }), 'approve plan');
  return { planId, planName };
}

async function event(token: string, unitId: string, start: number, end: number, extra: Record<string, unknown>): Promise<string> {
  return created(post(token, '/v2/production-events', { unitId, startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString(), ...extra }), 'event');
}

interface SummaryRow {
  periodId: string;
  shiftName: string | null;
  plan: { gap: string | null; attributed: string | null } | null;
}

async function calculatedPeriods(token: string, unitId: string, day: { from: string; to: string }): Promise<PeriodWorld['periods']> {
  const query = `unitIds=${unitId}&from=${encodeURIComponent(day.from)}&to=${encodeURIComponent(day.to)}`;
  const rows = await until('calculated periods with candidates', async () => {
    const list = await api<{ items: SummaryRow[] }>(token, 'GET', `/v2/period-summaries?${query}`);
    const items = itemsOf(list.body);
    const ready = items.length === 3 && items.every((r) => r.plan?.gap === '150') && items.filter((r) => r.plan?.attributed === '90').length === 2;
    return ready ? items : null;
  });
  const byShift = (name: string) => rows.find((r) => r.shiftName === name)?.periodId ?? '';
  return { a: byShift('A'), b: byShift('B'), c: byShift('C') };
}

/** One operational day three days ago: 3 × 1000 t target, 850 t output per shift, a 1 h stop in A and B. */
async function seedPeriodWorld(token: string, tenantId: string): Promise<PeriodWorld> {
  const unit = await seedPlanningUnit(token, tenantId, 'PD');
  const suffix = unit.unitCode.slice(-8);
  const dayStart = Date.parse(`${utcDate(-3)}T06:00:00.000Z`);
  const { planId, planName } = await approvedPlan(token, unit, suffix, dayStart);
  const day = { from: new Date(dayStart).toISOString(), to: new Date(dayStart + DAY).toISOString() };
  await ok(post(token, '/v2/production-periods/materialize', { unitIds: [unit.unitId], ...day }), 'materialize');
  for (const shift of [0, 8, 16]) {
    await event(token, unit.unitId, dayStart + shift * HOUR, dayStart + (shift + 8) * HOUR, { physicalType: 'production_output', eventType: 'ProductionOutput', quantity: '850', quantityUom: 't' });
  }
  const stops = {
    a: await event(token, unit.unitId, dayStart + 2 * HOUR, dayStart + 3 * HOUR, { physicalType: 'downtime', scheduleClass: 'unplanned', description: `${PREFIX}PD feed stop A ${suffix}` }),
    b: await event(token, unit.unitId, dayStart + 10 * HOUR, dayStart + 11 * HOUR, { physicalType: 'downtime', scheduleClass: 'unplanned', description: `${PREFIX}PD feed stop B ${suffix}` }),
  };
  const reasonCodeId = await created(post(token, '/v2/reason-codes', { code: `${PREFIX}PD-${suffix}`, name: `${PREFIX}PD feed ${suffix}`, effectiveFrom: `${utcDate(-10)}T00:00:00.000Z` }), 'reason code');
  await ok(post(token, '/v2/production-periods/recalculate', { unitIds: [unit.unitId], ...day }), 'recalculate');
  const periods = await calculatedPeriods(token, unit.unitId, day);
  return { suffix, unitId: unit.unitId, unitName: unit.unitName, productId: unit.productId, planId, planName, reasonCodeId, periods, stops, dayStart, day };
}

export interface DowntimeWorld {
  unitId: string;
  unitName: string;
  from: string;
  to: string;
  assets: { pump: string; valve: string };
  reasons: { mechanical: string; bearing: string; seal: string; electrical: string };
}

async function reasonTree(token: string, suffix: string): Promise<DowntimeWorld['reasons']> {
  const reason = (code: string, name: string, parentId?: string) =>
    created(post(token, '/v2/reason-codes', { code: `${PREFIX}${code}-${suffix}`, name, ...(parentId ? { parentId } : {}) }), `reason ${code}`);
  const mechanical = await reason('MECH', `${PREFIX}Mechanical ${suffix}`);
  return {
    mechanical,
    bearing: await reason('BRG', `${PREFIX}Bearing ${suffix}`, mechanical),
    seal: await reason('SEAL', `${PREFIX}Seal ${suffix}`, mechanical),
    electrical: await reason('ELEC', `${PREFIX}Electrical ${suffix}`),
  };
}

async function stops(token: string, world: Omit<DowntimeWorld, 'from' | 'to'>, dayStart: number): Promise<void> {
  const stop = (startMin: number, minutes: number, extra: Record<string, unknown>) =>
    event(token, world.unitId, dayStart + startMin * MINUTE, dayStart + (startMin + minutes) * MINUTE, { physicalType: 'downtime', ...extra });
  await stop(120, 60, { scheduleClass: 'unplanned', assetId: world.assets.pump, reasonCodeId: world.reasons.bearing });
  await stop(150, 60, { scheduleClass: 'unplanned', assetId: world.assets.valve, reasonCodeId: world.reasons.seal });
  await stop(300, 30, { scheduleClass: 'unplanned', reasonCodeId: world.reasons.electrical });
  await stop(420, 15, { scheduleClass: 'unknown' });
}

async function waitForRuns(token: string, unitId: string, from: string, to: string): Promise<void> {
  const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&unitIds=${unitId}&groupBy=oee`;
  await until('downtime calculation runs', async () => {
    const report = await api<{ data?: { calculationRunIds: string[]; total: string } }>(token, 'GET', `/v2/reports/downtime?${query}`);
    return report.body.data?.calculationRunIds.length === 3 && report.body.data.total !== '0' ? true : null;
  });
}

/** The AN01 fixture: two overlapping asset stops (Bearing / Seal under Mechanical), an Electrical stop and an unknown one, two days ago. */
async function seedDowntimeWorld(token: string, tenantId: string): Promise<DowntimeWorld> {
  const unit = await seedPlanningUnit(token, tenantId, 'DT');
  const suffix = unit.unitCode.slice(-8);
  const dayStart = Date.parse(`${utcDate(-2)}T06:00:00.000Z`);
  const from = new Date(dayStart).toISOString();
  const to = new Date(dayStart + DAY).toISOString();
  const materialized = await ok(post<{ created: number }>(token, '/v2/production-periods/materialize', { unitIds: [unit.unitId], from, to }), 'materialize');
  if (materialized.created !== 3) throw new Error(`materialize: ${JSON.stringify(materialized)}`);
  const asset = (code: string, name: string) =>
    created(api(token, 'POST', '/assets', { code: `${PREFIX}${code}-${suffix}`, name: `${PREFIX}${name} ${suffix}`, unitId: unit.unitId, tenantId }), `asset ${code}`);
  const world = { unitId: unit.unitId, unitName: unit.unitName, assets: { pump: await asset('PMP', 'Pump'), valve: await asset('VLV', 'Valve') }, reasons: await reasonTree(token, suffix) };
  await stops(token, world, dayStart);
  await ok(post(token, '/v2/production-periods/recalculate', { unitIds: [unit.unitId], from, to }), 'recalculate');
  await waitForRuns(token, unit.unitId, from, to);
  return { ...world, from, to };
}

interface Cached<T> {
  day: string;
  world: T;
}

/** Reuses today's world from test-results/ (the persona specs run in one session), else seeds and stores it. */
async function cached<T>(name: string, seed: () => Promise<T>, fresh = false): Promise<T> {
  const file = join(CACHE_DIR, `p-mgr-${name}.json`);
  const today = utcDate(0);
  if (!fresh && existsSync(file)) {
    const stored = JSON.parse(readFileSync(file, 'utf8')) as Cached<T>;
    if (stored.day === today) return stored.world;
  }
  const world = await seed();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify({ day: today, world } satisfies Cached<T>));
  return world;
}

/** `fresh`: always seed (the periods spec starts every run on untouched revisions); the analytics spec reads what it seeded. */
export const ensurePeriodWorld = (token: string, tenantId: string, fresh = false): Promise<PeriodWorld> => cached('period-world', () => seedPeriodWorld(token, tenantId), fresh);
export const ensureDowntimeWorld = (token: string, tenantId: string): Promise<DowntimeWorld> => cached('downtime-world', () => seedDowntimeWorld(token, tenantId));
