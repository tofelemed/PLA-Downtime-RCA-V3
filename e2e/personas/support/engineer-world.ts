import { randomUUID } from 'node:crypto';
import { call, command } from '../../test-utils/downtime-world';
import { reconciliation, type DashboardWorld } from '../../test-utils/dashboard-world';
import { secondApproverToken } from '../../test-utils/second-approver';
import { PREFIX } from './engineer-users';

/**
 * Seeds the production engineer persona journeys through the API. Everything is new data prefixed
 * `P-ENG` in Demo Plant; nothing existing is changed and nothing is ever deleted.
 * - `kind: 'PLAN'`: a unit with a published UTC calendar of 6 h / 6 h / 8 h shifts (A 06–12, B 12–18,
 *   C 18–02), an approved profile (t per h) with approved planning 50 t/h and sustained 60 t/h → preview
 *   capacities 300 / 300 / 400 t on any day; the plan day is five days ahead.
 * - `kind: 'PD'`: like the plan 3.5 dashboard world — 3 × 8 h shifts, planning 90 t/h, sustained 100 t/h,
 *   an approved 3000 t quantity plan over one operational day three days ago, 850 t output and a 1 h stop
 *   in shifts A and B (gap 150, availability candidate 90), recalculated.
 * The master data and approvals are the setup manager's (its own profile and rate drafts are approved by
 * the second approver: D06 separation of duties); the plan, periods and events are written by an
 * engineer, as the API lets production engineers do (PLAN_WRITERS / PERIOD_WRITERS).
 */
const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface EngineerWorld extends DashboardWorld {
  productId: string;
  productName: string;
  productCode: string;
  profileId: string;
  reasons: { feed: string; motor: string };
  /** UTC date of the planned day (YYYY-MM-DD), PLAN worlds only */
  planDay: string;
}

type Shift = { name: string; startLocal: string; endLocal: string };
const PD_SHIFTS: Shift[] = [
  { name: 'A', startLocal: '06:00', endLocal: '14:00' },
  { name: 'B', startLocal: '14:00', endLocal: '22:00' },
  { name: 'C', startLocal: '22:00', endLocal: '06:00' },
];
const PLAN_SHIFTS: Shift[] = [
  { name: 'A', startLocal: '06:00', endLocal: '12:00' },
  { name: 'B', startLocal: '12:00', endLocal: '18:00' },
  { name: 'C', startLocal: '18:00', endLocal: '02:00' },
];

export const utcDate = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

export async function created(pending: Promise<{ status: number; body: unknown }>, what: string): Promise<string> {
  const result = await pending;
  if (![200, 201, 202].includes(result.status)) throw new Error(`${what}: ${result.status} ${JSON.stringify(result.body)}`);
  const body = result.body as { id?: string; jobId?: string };
  return body.id ?? body.jobId ?? '';
}

export async function until<T>(what: string, probe: () => Promise<T | null>, attempts = 90): Promise<T> {
  for (let i = 0; i < attempts; i += 1) {
    const value = await probe();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`timed out waiting for ${what}`);
}

interface Rates {
  planning: string;
  sustained: string;
}

async function masterData(setup: string, tenantId: string, suffix: string, kind: 'PLAN' | 'PD') {
  const unitName = `${PREFIX} ${kind} ${suffix}`;
  const unitId = await created(call(setup, 'POST', '/units', { name: unitName, code: `${PREFIX}-${kind}-${suffix}`, tenantId }), 'unit');
  const calendar = await created(
    command(setup, '/v2/calendar-versions', { unitId, timezone: 'UTC', operationalDayStart: '06:00', shiftTemplates: kind === 'PD' ? PD_SHIFTS : PLAN_SHIFTS, effectiveFrom: utcDate(-6) }),
    'calendar',
  );
  await created(command(setup, `/v2/calendar-versions/${calendar}/publish`, {}), 'publish calendar');
  const productName = `${PREFIX} product ${suffix}`;
  const productCode = `${PREFIX}-P-${suffix}`;
  const productId = await created(call(setup, 'POST', '/products', { name: productName, code: productCode, tenantId }), 'product');
  const from = `${utcDate(-10)}T00:00:00Z`;
  const profileId = await created(command(setup, '/v2/profiles', { unitId, productId, quantityUom: 't', rateTimebase: 'h', effectiveFrom: from }), 'profile');
  const approver = await secondApproverToken(setup);
  await created(command(approver, `/v2/profiles/${profileId}/approve`, {}), 'approve profile');
  const rates: Rates = kind === 'PD' ? { planning: '90', sustained: '100' } : { planning: '50', sustained: '60' };
  for (const [rateKind, rate] of Object.entries(rates)) {
    const rateId = await created(command(setup, `/v2/profiles/${profileId}/rates`, { rateKind, rate, timebase: 'h', effectiveFrom: from }), `${rateKind} rate`);
    await created(command(approver, `/v2/rates/${rateId}/approve`, {}), `approve ${rateKind}`);
  }
  const reason = (code: string, name: string) =>
    created(command(setup, '/v2/reason-codes', { code: `${PREFIX}-${code}-${suffix}`, name: `${PREFIX} ${name} ${suffix}`, effectiveFrom: `${utcDate(-10)}T00:00:00.000Z` }), `reason ${code}`);
  const reasons = { feed: await reason('FEED', 'feed interruption'), motor: await reason('MOTOR', 'motor trip') };
  return { unitId, unitName, productId, productName, productCode, profileId, reasons };
}

/** The engineer prepares and generates the plan (PLAN_WRITERS); the manager approves it (PLAN_APPROVERS). */
async function approvedPlan(engineer: string, setup: string, unitId: string, productId: string, suffix: string, dayStart: number) {
  const body = { name: `${PREFIX} plan ${suffix}`, unitId, validFrom: new Date(dayStart).toISOString(), validTo: new Date(dayStart + DAY).toISOString(), basis: 'quantity', headerTarget: '3000', slices: [{ productId }] };
  const planId = await created(command(engineer, '/v2/production-plans', body), 'plan');
  const jobId = await created(command(engineer, `/v2/production-plans/${planId}/generate-periods`, { version: 1 }), 'generate');
  await until('plan generation', async () => {
    const job = await call<{ state: string }>(engineer, 'GET', `/v2/plan-generation-jobs/${jobId}`);
    if (job.body.state === 'failed') throw new Error(`generation failed: ${JSON.stringify(job.body)}`);
    return job.body.state === 'completed' ? true : null;
  });
  await created(command(setup, `/v2/production-plans/${planId}/approve`, { expectedVersion: 1 }), 'approve plan');
  return planId;
}

export async function event(token: string, unitId: string, start: number, end: number, extra: Record<string, unknown>) {
  return created(command(token, '/v2/production-events', { unitId, startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString(), ...extra }), 'event');
}

interface SummaryRow {
  periodId: string;
  shiftName: string | null;
  plan: { gap: string | null; attributed: string | null } | null;
}

async function calculatedPeriods(token: string, unitId: string, window: { from: string; to: string }) {
  const query = `unitIds=${unitId}&from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}`;
  const rows = await until('calculated periods with candidates', async () => {
    const list = await call<{ items: SummaryRow[] }>(token, 'GET', `/v2/period-summaries?${query}`);
    const items = list.body.items ?? [];
    const ready = items.length === 3 && items.every((r) => r.plan?.gap === '150') && items.filter((r) => r.plan?.attributed === '90').length === 2;
    return ready ? items : null;
  });
  const byShift = (name: string) => rows.find((r) => r.shiftName === name)?.periodId ?? '';
  return { a: byShift('A'), b: byShift('B'), c: byShift('C') };
}

async function periodsOfTheDay(engineer: string, world: Omit<EngineerWorld, 'planId' | 'periods' | 'stops' | 'dayStart'>, dayStart: number, planId: string) {
  const window = { from: new Date(dayStart).toISOString(), to: new Date(dayStart + DAY).toISOString() };
  const materialized = await command<{ created: number }>(engineer, '/v2/production-periods/materialize', { unitIds: [world.unitId], ...window });
  if (materialized.status !== 200) throw new Error(`materialize: ${materialized.status} ${JSON.stringify(materialized.body)}`);
  for (const shift of [0, 8, 16]) {
    await event(engineer, world.unitId, dayStart + shift * HOUR, dayStart + (shift + 8) * HOUR, { physicalType: 'production_output', eventType: 'ProductionOutput', quantity: '850', quantityUom: 't' });
  }
  const stops = {
    a: await event(engineer, world.unitId, dayStart + 2 * HOUR, dayStart + 3 * HOUR, { physicalType: 'downtime', scheduleClass: 'unplanned', description: `${PREFIX} feed stop A ${world.suffix}` }),
    b: await event(engineer, world.unitId, dayStart + 10 * HOUR, dayStart + 11 * HOUR, { physicalType: 'downtime', scheduleClass: 'unplanned', description: `${PREFIX} motor stop B ${world.suffix}` }),
  };
  await command(engineer, '/v2/production-periods/recalculate', { unitIds: [world.unitId], ...window });
  const periods = await calculatedPeriods(engineer, world.unitId, window);
  return { ...world, planId, periods, stops, dayStart };
}

export async function seedEngineerWorld(setup: string, engineer: string, tenantId: string, kind: 'PLAN' | 'PD'): Promise<EngineerWorld> {
  const suffix = randomUUID().slice(0, 8);
  const base = { suffix, ...(await masterData(setup, tenantId, suffix, kind)), reasonCodeId: '', planDay: utcDate(5) };
  base.reasonCodeId = base.reasons.feed;
  if (kind === 'PLAN') return { ...base, planId: '', periods: { a: '', b: '', c: '' }, stops: { a: '', b: '' }, dayStart: 0 };
  const dayStart = Date.parse(`${utcDate(-3)}T06:00:00.000Z`);
  const planId = await approvedPlan(engineer, setup, base.unitId, base.productId, suffix, dayStart);
  return periodsOfTheDay(engineer, base, dayStart, planId);
}

/** The engineer's full accounting of a period without candidates: one manual line, submitted (PERIOD_WRITERS). */
export async function submitManualLine(engineer: string, periodId: string, reasonCodeId: string, quantity: string): Promise<void> {
  const attempt = async (): Promise<true | null> => {
    const view = await reconciliation(engineer, periodId);
    const lines = [{ action: 'manual', sliceId: view.slices[0].sliceId, kind: 'availability', quantity, missingEvent: true, reasonCodeId }];
    const saved = await call<{ revision: { revision: number }; baseRunId: string; contentHash: string; code?: string }>(
      engineer, 'PUT', `/v2/production-periods/${periodId}/draft-lines`, { revision: view.revision.revision, baseRunId: view.baseRunId, lines }, { 'If-Match': `"${view.rowVersion}"` },
    );
    if (saved.status === 409 && saved.body.code === 'RUN_CHANGED') return null;
    if (saved.status !== 200) throw new Error(`draft-lines: ${saved.status} ${JSON.stringify(saved.body)}`);
    const { revision, baseRunId, contentHash } = saved.body;
    const submitted = await command<{ code?: string }>(engineer, `/v2/production-periods/${periodId}/submit`, { revision: revision.revision, runId: baseRunId, contentHash });
    if (submitted.status === 200) return true;
    // a recalculation requested earlier may still be queued (422) or may have just replaced the run (409)
    if ((submitted.status === 422 && submitted.body.code === 'RECALCULATION_PENDING') || (submitted.status === 409 && submitted.body.code === 'RUN_CHANGED')) return null;
    throw new Error(`submit: ${submitted.status} ${JSON.stringify(submitted.body)}`);
  };
  await until('submit after the pending recalculation', attempt);
}

/** Setup only: the manager approver approves a submitted period (never the submitter). */
export async function approvePeriod(setup: string, periodId: string): Promise<void> {
  const view = await call<{ revision: { revision: number; submittedHash: string } }>(setup, 'GET', `/v2/production-periods/${periodId}/reconciliation`);
  const { revision, submittedHash } = view.body.revision;
  const approved = await command(setup, `/v2/production-periods/${periodId}/approve`, { revision, submittedHash });
  if (approved.status !== 200) throw new Error(`approve: ${approved.status} ${JSON.stringify(approved.body)}`);
}
