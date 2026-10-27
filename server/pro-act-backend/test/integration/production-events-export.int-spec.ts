import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { CSV_BOM } from '../../src/exports/csv';
import { EXPORT_LABEL_COLUMNS } from '../../src/v2/production-events/production-events-export-labels';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { at, EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

const HEADER =
  'start_utc,end_utc,duration_seconds,unit,asset,event_type,physical_type,schedule_class,oee_component,' +
  'reason_code,reason,physical_state,coding_state,rca_state,severity,source_kind,description,quantity,' +
  'quantity_uom,cost,planned,actual,shortfall,ot_status,' +
  EXPORT_LABEL_COLUMNS.join(',');

/** Event Hub parity on `/v2/production-events`: source kind, severity and text filters, CSV export. */
describe('production events v2: Event Hub filters and CSV export', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let token: string;

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    token = signToken(app, { userId: randomUUID(), tenantId: world.tenantA });
    await harness.dataSource.query(
      `UPDATE production_events SET severity = 'Critical' WHERE id = $1`,
      [world.events.e1],
    );
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const get = (path: string, query: Record<string, unknown>) =>
    request(app.getHttpServer())
      .get(`/api/v2/production-events${path}`)
      .query(query)
      .set(bearer(token));
  const listIds = async (query: Record<string, unknown>) =>
    (
      (await get('', query).expect(200)).body as {
        items: Array<{ id: string }>;
      }
    ).items
      .map((item) => item.id)
      .sort();

  it('filters by severity, source kind and text in description or event id', async () => {
    const { e1, e2 } = world.events;
    expect(await listIds({ severities: 'Critical' })).toEqual([e1]);
    expect(
      await listIds({ severities: 'Critical', sourceKinds: 'source' }),
    ).toEqual([]);
    expect(
      await listIds({ q: `evt-${e1.slice(0, 8)}`, unitIds: world.unitA1 }),
    ).toEqual([e1]);
    expect(await listIds({ q: 'iow ON', unitIds: world.unitA1 })).toEqual([e2]);
    expect(await listIds({ q: '%_', unitIds: world.unitA1 })).toEqual([]);
  });

  it('exports the filtered events as CSV, newest first, with names instead of ids', async () => {
    const response = await get('/export', {
      from: at('08:00').toISOString(),
      to: at('10:00').toISOString(),
      unitIds: world.unitA1,
    }).expect(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="production-events-2026-10-07.csv"',
    );
    expect(response.text.startsWith(CSV_BOM)).toBe(true);
    const lines = response.text.slice(CSV_BOM.length).trimEnd().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(HEADER);
    const [iow, loss] = lines.slice(1).map((line) => line.split(','));
    expect(iow[0]).toBe(at('09:30').toISOString());
    expect(iow[2]).toBe('1800');
    expect(iow[10]).toBe('Electrical');
    expect(loss[3]).toMatch(/^unit100-/);
    expect(loss[4]).toBe('Extruder');
    expect(loss[9]).toMatch(/^R1-/);
    expect(loss[10]).toBe('Mechanical');
    expect(loss[14]).toBe('Critical');
    expect(Number(loss[17])).toBe(12.5);
    expect(response.text).not.toContain(world.unitA1);
  });

  it('422 without from, with a reversed window or over 400 days', async () => {
    await get('/export', { to: at('10:00').toISOString() }).expect(422);
    const reversed = await get('/export', {
      from: at('10:00').toISOString(),
      to: at('08:00').toISOString(),
    }).expect(422);
    expect((reversed.body as { code: string }).code).toBe('INVALID_RANGE');
    await get('/export', {
      from: '2025-01-01T00:00:00Z',
      to: '2026-10-01T00:00:00Z',
    }).expect(422);
    await get('/export', {
      from: at('08:00').toISOString(),
      to: at('10:00').toISOString(),
      limit: 10,
    }).expect(422);
  });
});
