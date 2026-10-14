import { randomUUID } from 'node:crypto';
import { call, command } from './downtime-world';
import { secondApproverToken } from './second-approver';

/**
 * Seeds the plan 3.5 e2e through the API (new "E2E PD …" unit / product / reason code / plan; nothing
 * existing is changed): a published UTC unit calendar (A 06–14, B 14–22, C 22–06), an approved profile
 * with planning 90 t/h and sustained 100 t/h, an approved quantity plan of 2160 t (the planned rate equals the 90 t/h planning rate, LA-01) over one operational
 * day three days ago (720 t per 8 h shift), the production periods of that day with an output of 570 t
 * each (gap 150) and a 1 h stop in shifts A and B (an availability candidate of 90 t at the planned
 * rate), recalculated. Period A then holds the T15 situation once `seedT15Lines` saved accept 90 + 50.
 * The manager drafts the profile, rates and plan; the second approver approves them (D06).
 */
const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface DashboardWorld {
  suffix: string;
  unitId: string;
  unitName: string;
  planId: string;
  reasonCodeId: string;
  periods: { a: string; b: string; c: string };
  stops: { a: string; b: string };
  dayStart: number;
}

const utcDate = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

async function created(pending: Promise<{ status: number; body: unknown }>, what: string): Promise<string> {
  const result = await pending;
  if (result.status !== 201 && result.status !== 200 && result.status !== 202) throw new Error(`${what}: ${result.status} ${JSON.stringify(result.body)}`);
  const body = result.body as { id?: string; jobId?: string };
  return body.id ?? body.jobId ?? '';
}

async function until<T>(what: string, probe: () => Promise<T | null>, attempts = 90): Promise<T> {
  for (let i = 0; i < attempts; i += 1) {
    const value = await probe();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function unitWithProfile(token: string, approver: string, tenantId: string, suffix: string) {
  const unitName = `E2E PD ${suffix}`;
  const unitId = await created(call(token, 'POST', '/units', { name: unitName, code: `E2E-PD-${suffix}`, tenantId }), 'unit');
  const calendar = await created(
    command(token, '/v2/calendar-versions', {
      unitId,
      timezone: 'UTC',
      operationalDayStart: '06:00',
      shiftTemplates: [
        { name: 'A', startLocal: '06:00', endLocal: '14:00' },
        { name: 'B', startLocal: '14:00', endLocal: '22:00' },
        { name: 'C', startLocal: '22:00', endLocal: '06:00' },
      ],
      effectiveFrom: utcDate(-6),
    }),
    'calendar',
  );
  await created(command(token, `/v2/calendar-versions/${calendar}/publish`, {}), 'publish calendar');
  const productId = await created(call(token, 'POST', '/products', { name: `E2E PD product ${suffix}`, code: `E2E-PDP-${suffix}`, tenantId }), 'product');
  const from = `${utcDate(-10)}T00:00:00Z`;
  const profileId = await created(command(token, '/v2/profiles', { unitId, productId, quantityUom: 't', rateTimebase: 'h', effectiveFrom: from }), 'profile');
  await created(command(approver, `/v2/profiles/${profileId}/approve`, {}), 'approve profile');
  for (const [rateKind, rate] of [['planning', '90'], ['sustained', '100']]) {
    const rateId = await created(command(token, `/v2/profiles/${profileId}/rates`, { rateKind, rate, timebase: 'h', effectiveFrom: from }), `${rateKind} rate`);
    await created(command(approver, `/v2/rates/${rateId}/approve`, {}), `approve ${rateKind}`);
  }
  return { unitId, unitName, productId };
}

async function approvedPlan(tokens: { author: string; approver: string }, unit: { unitId: string; productId: string }, suffix: string, dayStart: number) {
  const token = tokens.author;
  const { unitId, productId } = unit;
  const body = { name: `E2E PD plan ${suffix}`, unitId, validFrom: new Date(dayStart).toISOString(), validTo: new Date(dayStart + DAY).toISOString(), basis: 'quantity', headerTarget: '2160', slices: [{ productId }] };
  const planId = await created(command(token, '/v2/production-plans', body), 'plan');
  const jobId = await created(command(token, `/v2/production-plans/${planId}/generate-periods`, { version: 1 }), 'generate');
  await until('plan generation', async () => {
    const job = await call<{ state: string }>(token, 'GET', `/v2/plan-generation-jobs/${jobId}`);
    if (job.body.state === 'failed') throw new Error(`generation failed: ${JSON.stringify(job.body)}`);
    return job.body.state === 'completed' ? true : null;
  });
  await created(command(tokens.approver, `/v2/production-plans/${planId}/approve`, { expectedVersion: 1 }), 'approve plan');
  return planId;
}

async function event(token: string, unitId: string, start: number, end: number, extra: Record<string, unknown>) {
  return created(command(token, '/v2/production-events', { unitId, startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString(), ...extra }), 'event');
}

export async function seedDashboardWorld(token: string, tenantId: string): Promise<DashboardWorld> {
  const suffix = randomUUID().slice(0, 8);
  const approver = await secondApproverToken(token);
  const { unitId, unitName, productId } = await unitWithProfile(token, approver, tenantId, suffix);
  const dayStart = Date.parse(`${utcDate(-3)}T06:00:00.000Z`);
  const planId = await approvedPlan({ author: token, approver }, { unitId, productId }, suffix, dayStart);
  const window = { from: new Date(dayStart).toISOString(), to: new Date(dayStart + DAY).toISOString() };
  const materialized = await command<{ created: number }>(token, '/v2/production-periods/materialize', { unitIds: [unitId], ...window });
  if (materialized.status !== 200) throw new Error(`materialize: ${JSON.stringify(materialized.body)}`);
  for (const shift of [0, 8, 16]) {
    await event(token, unitId, dayStart + shift * HOUR, dayStart + (shift + 8) * HOUR, { physicalType: 'production_output', eventType: 'ProductionOutput', quantity: '570', quantityUom: 't' });
  }
  const stops = {
    a: await event(token, unitId, dayStart + 2 * HOUR, dayStart + 3 * HOUR, { physicalType: 'downtime', scheduleClass: 'unplanned', description: `E2E PD feed stop A ${suffix}` }),
    b: await event(token, unitId, dayStart + 10 * HOUR, dayStart + 11 * HOUR, { physicalType: 'downtime', scheduleClass: 'unplanned', description: `E2E PD feed stop B ${suffix}` }),
  };
  const reasonCodeId = await created(command(token, '/v2/reason-codes', { code: `E2E-PD-${suffix}`, name: `E2E PD feed ${suffix}`, effectiveFrom: `${utcDate(-10)}T00:00:00.000Z` }), 'reason code');
  await command(token, '/v2/production-periods/recalculate', { unitIds: [unitId], ...window });
  const periods = await calculatedPeriods(token, unitId, window);
  return { suffix, unitId, unitName, planId, reasonCodeId, periods, stops, dayStart };
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

interface ViewBody {
  rowVersion: number;
  baseRunId: string;
  revision: { revision: number };
  slices: Array<{ sliceId: string }>;
  candidates: Array<{ autoKey: string }>;
  contentHash: string;
}

export async function reconciliation(token: string, periodId: string): Promise<ViewBody> {
  return (await call<ViewBody>(token, 'GET', `/v2/production-periods/${periodId}/reconciliation`)).body;
}

/** Saves lines on the period's draft through the API (accept the candidate + manual lines without event). */
export async function saveLines(token: string, periodId: string, reasonCodeId: string, manual: string[]): Promise<ViewBody> {
  const view = await reconciliation(token, periodId);
  const lines = [
    { action: 'accept', autoKey: view.candidates[0].autoKey },
    ...manual.map((quantity) => ({ action: 'manual', sliceId: view.slices[0].sliceId, kind: 'availability', quantity, missingEvent: true, evidenceType: 'log', evidenceRef: 'e2e shift log', reasonCodeId })),
  ];
  const saved = await call<ViewBody>(token, 'PUT', `/v2/production-periods/${periodId}/draft-lines`, { revision: view.revision.revision, baseRunId: view.baseRunId, lines }, { 'If-Match': `"${view.rowVersion}"` });
  if (saved.status !== 200) throw new Error(`draft-lines: ${saved.status} ${JSON.stringify(saved.body)}`);
  return saved.body;
}

/** A second manager approver of the demo tenant, created once by the manager through the admin register route. */
export async function ensureApprover(managerToken: string, tenantId: string, organizationId: string, email: string, password: string): Promise<void> {
  const result = await call(managerToken, 'POST', '/auth/register', { name: 'E2E PD approver', email, password, role: 'TenantAdmin', tenantId, organizationId });
  if (result.status !== 201 && result.status !== 409) throw new Error(`register approver: ${result.status} ${JSON.stringify(result.body)}`);
}
