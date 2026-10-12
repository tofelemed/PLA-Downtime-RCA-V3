import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { call, command } from './downtime-world';
import { secondApproverToken } from './second-approver';

/**
 * Seeds the plan 3.4 e2e through the API (new "E2E PLAN …" / "E2E CAL …" units and an "E2E PLAN …"
 * product; nothing existing is changed):
 * - plan unit: a published UTC unit calendar with three shifts of 6 h, 6 h and 8 h (A 06–12, B 12–18,
 *   C 18–02) from yesterday, an approved profile (t per h) with approved planning 50 t/h and sustained
 *   60 t/h rates from ten days ago → planning capacities 300 / 300 / 400 t on any day (drafted by the
 *   manager, approved by the second approver: D06 separation of duties);
 * - calendar unit: nothing but the unit (the DST calendar is created in the UI).
 * The plan day is five days ahead (inside the 90-day materialized horizon, never today).
 */
const DAY = 86_400_000;

export interface PlanningWorld {
  suffix: string;
  planUnitId: string;
  planUnitName: string;
  calUnitName: string;
  productId: string;
  productName: string;
  profileId: string;
  /** UTC date of the planned day (YYYY-MM-DD) */
  planDay: string;
}

const utcDate = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

async function created(pending: Promise<{ status: number; body: unknown }>, what: string): Promise<string> {
  const result = await pending;
  if (result.status !== 201 && result.status !== 200) throw new Error(`${what}: ${result.status} ${JSON.stringify(result.body)}`);
  return (result.body as { id: string }).id;
}

interface Tokens {
  author: string;
  approver: string;
}

async function approvedRate(tokens: Tokens, profileId: string, rate: { kind: string; value: string }, from: string) {
  const id = await created(command(tokens.author, `/v2/profiles/${profileId}/rates`, { rateKind: rate.kind, rate: rate.value, timebase: 'h', effectiveFrom: from }), `${rate.kind} rate`);
  await created(command(tokens.approver, `/v2/rates/${id}/approve`, {}), `approve ${rate.kind}`);
}

async function planCalendar(token: string, unitId: string) {
  const calendar = await created(
    command(token, '/v2/calendar-versions', {
      unitId,
      timezone: 'UTC',
      operationalDayStart: '06:00',
      shiftTemplates: [
        { name: 'A', startLocal: '06:00', endLocal: '12:00' },
        { name: 'B', startLocal: '12:00', endLocal: '18:00' },
        { name: 'C', startLocal: '18:00', endLocal: '02:00' },
      ],
      effectiveFrom: utcDate(-1),
    }),
    'plan calendar',
  );
  const published = await command(token, `/v2/calendar-versions/${calendar}/publish`, {});
  if (published.status !== 200) throw new Error(`publish: ${published.status} ${JSON.stringify(published.body)}`);
}

export async function seedPlanningWorld(token: string, tenantId: string): Promise<PlanningWorld> {
  const suffix = randomUUID().slice(0, 8);
  const unit = (kind: string) => created(call(token, 'POST', '/units', { name: `E2E ${kind} ${suffix}`, code: `E2E-${kind}-${suffix}`, tenantId }), `${kind} unit`);
  const planUnitId = await unit('PLAN');
  await unit('CAL');
  const productName = `E2E PLAN product ${suffix}`;
  const productId = await created(call(token, 'POST', '/products', { name: productName, code: `E2E-PP-${suffix}`, tenantId }), 'product');
  await planCalendar(token, planUnitId);
  const from = `${utcDate(-10)}T00:00:00Z`;
  const profileId = await created(command(token, '/v2/profiles', { unitId: planUnitId, productId, quantityUom: 't', rateTimebase: 'h', effectiveFrom: from }), 'profile');
  const tokens = { author: token, approver: await secondApproverToken(token) };
  await created(command(tokens.approver, `/v2/profiles/${profileId}/approve`, {}), 'approve profile');
  await approvedRate(tokens, profileId, { kind: 'planning', value: '50' }, from);
  await approvedRate(tokens, profileId, { kind: 'sustained', value: '60' }, from);
  return {
    suffix,
    planUnitId,
    planUnitName: `E2E PLAN ${suffix}`,
    calUnitName: `E2E CAL ${suffix}`,
    productId,
    productName,
    profileId,
    planDay: utcDate(5),
  };
}

/** `YYYY-MM-DDTHH:mm` of a UTC instant on the plant clock, as a datetime-local input expects it. */
export function plantLocal(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

/** The date + time fields the planning forms use (`DateTimeInput`, Gregorian plant): fills a plant-local `YYYY-MM-DDTHH:mm`. */
export async function fillPlantDateTime(page: Page, label: string, local: string): Promise<void> {
  const [date, time] = local.split('T');
  await page.getByLabel(`${label} date`, { exact: true }).fill(date);
  await page.getByLabel(`${label} time`, { exact: true }).fill(time);
}
