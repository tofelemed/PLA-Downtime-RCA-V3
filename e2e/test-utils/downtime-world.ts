import { randomUUID } from 'node:crypto';

/**
 * Seeds a computed downtime window through the API for the plan 3.3 e2e (Demo Plant has no calendar or
 * approved profile): a fresh unit with its own published UTC calendar (3 × 8 h shifts), a product and
 * an approved profile, the periods of one operational day two days ago, two assets, a reason tree and
 * four stops, then a recalculation; waits until the downtime report shows the calculated runs.
 * Everything is new test data named "E2E DT …"; nothing existing is changed.
 */
const API = process.env.VITE_API_BASE_URL || 'http://localhost:4004/api';
const MINUTE = 60_000;
const DAY = 86_400_000;

export interface ApiResult<T> {
  status: number;
  body: T;
}

export async function call<T>(token: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<ApiResult<T>> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T };
}

export const command = <T>(token: string, path: string, body: unknown) => call<T>(token, 'POST', path, body, { 'Idempotency-Key': randomUUID() });

async function created<T extends { id: string }>(pending: Promise<ApiResult<T>>, what: string): Promise<string> {
  const result = await pending;
  if (result.status !== 201 && result.status !== 200) throw new Error(`${what}: ${result.status} ${JSON.stringify(result.body)}`);
  return result.body.id;
}

export interface DowntimeWorld {
  unitId: string;
  unitName: string;
  from: string;
  to: string;
  assets: { pump: string; valve: string };
  reasons: { mechanical: string; bearing: string; seal: string; electrical: string };
}

const localDate = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

async function unitWithCalendar(token: string, tenantId: string, suffix: string) {
  const unitName = `E2E DT ${suffix}`;
  const unitId = await created(call<{ id: string }>(token, 'POST', '/units', { name: unitName, code: `E2E-DT-${suffix}`, tenantId }), 'unit');
  const calendar = await created(
    command<{ id: string }>(token, '/v2/calendar-versions', {
      timezone: 'UTC',
      operationalDayStart: '06:00',
      shiftTemplates: [
        { name: 'A', startLocal: '06:00', endLocal: '14:00' },
        { name: 'B', startLocal: '14:00', endLocal: '22:00' },
        { name: 'C', startLocal: '22:00', endLocal: '06:00' },
      ],
      unitId,
      effectiveFrom: localDate(-3),
    }),
    'calendar',
  );
  const published = await command(token, `/v2/calendar-versions/${calendar}/publish`, {});
  if (published.status !== 200) throw new Error(`publish: ${published.status}`);
  const product = await created(call<{ id: string }>(token, 'POST', '/products', { name: `E2E DT product ${suffix}`, code: `E2E-DTP-${suffix}`, tenantId }), 'product');
  const profile = await created(
    command<{ id: string }>(token, '/v2/profiles', { unitId, productId: product, quantityUom: 't', rateTimebase: 'h', effectiveFrom: `${localDate(-5)}T00:00:00Z` }),
    'profile',
  );
  await created(command<{ id: string }>(token, `/v2/profiles/${profile}/approve`, {}), 'approve profile');
  return { unitId, unitName };
}

async function reasonTree(token: string, suffix: string) {
  const reason = (code: string, name: string, parentId?: string) =>
    created(command<{ id: string }>(token, '/v2/reason-codes', { code: `E2E-${code}-${suffix}`, name, parentId }), `reason ${code}`);
  const mechanical = await reason('MECH', `Mechanical ${suffix}`);
  return {
    mechanical,
    bearing: await reason('BRG', `Bearing ${suffix}`, mechanical),
    seal: await reason('SEAL', `Seal ${suffix}`, mechanical),
    electrical: await reason('ELEC', `Electrical ${suffix}`),
  };
}

/** Stops of the operational day (UTC 08:00 start): two overlapping asset stops, one other, one unknown. */
async function stops(token: string, world: Omit<DowntimeWorld, 'from' | 'to'>, dayStart: number) {
  const stop = (startMin: number, minutes: number, extra: Record<string, unknown>) =>
    created(
      command<{ id: string }>(token, '/v2/production-events', {
        unitId: world.unitId,
        startTime: new Date(dayStart + startMin * MINUTE).toISOString(),
        endTime: new Date(dayStart + (startMin + minutes) * MINUTE).toISOString(),
        physicalType: 'downtime',
        ...extra,
      }),
      'stop',
    );
  await stop(120, 60, { scheduleClass: 'unplanned', assetId: world.assets.pump, reasonCodeId: world.reasons.bearing });
  await stop(150, 60, { scheduleClass: 'unplanned', assetId: world.assets.valve, reasonCodeId: world.reasons.seal });
  await stop(300, 30, { scheduleClass: 'unplanned', reasonCodeId: world.reasons.electrical });
  await stop(420, 15, { scheduleClass: 'unknown' });
}

export async function seedDowntimeWorld(token: string, tenantId: string): Promise<DowntimeWorld> {
  const suffix = randomUUID().slice(0, 8);
  const { unitId, unitName } = await unitWithCalendar(token, tenantId, suffix);
  const dayStart = Date.parse(`${localDate(-2)}T06:00:00.000Z`);
  const from = new Date(dayStart).toISOString();
  const to = new Date(dayStart + DAY).toISOString();
  const materialized = await command<{ created: number }>(token, '/v2/production-periods/materialize', { unitIds: [unitId], from, to });
  if (materialized.status !== 200 || materialized.body.created !== 3) throw new Error(`materialize: ${JSON.stringify(materialized.body)}`);
  const asset = (code: string, name: string) =>
    created(call<{ id: string }>(token, 'POST', '/assets', { code: `E2E-${code}-${suffix}`, name: `${name} ${suffix}`, unitId, tenantId }), `asset ${code}`);
  const world = { unitId, unitName, assets: { pump: await asset('PMP', 'Pump'), valve: await asset('VLV', 'Valve') }, reasons: await reasonTree(token, suffix) };
  await stops(token, world, dayStart);
  await command(token, '/v2/production-periods/recalculate', { unitIds: [unitId], from, to });
  await waitForRuns(token, unitId, from, to);
  return { ...world, from, to };
}

async function waitForRuns(token: string, unitId: string, from: string, to: string): Promise<void> {
  const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&unitIds=${unitId}&groupBy=oee`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const report = await call<{ data: { calculationRunIds: string[]; total: string } }>(token, 'GET', `/v2/reports/downtime?${query}`);
    if (report.body.data?.calculationRunIds.length === 3 && report.body.data.total !== '0') return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('calculation runs did not appear');
}
