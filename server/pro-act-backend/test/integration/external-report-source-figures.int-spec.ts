import { ConflictException } from '@nestjs/common';
import { ExternalReportDraft } from '../../src/domain/actuals/period/external-report';
import { ExternalReportsService } from '../../src/periods/external-reports.service';
import { ActualsWorld } from './support/actuals-world';

interface ReportView {
  id: string;
  externalReportId: string;
  localProductionDate: string;
  connectionId: string | null;
  sourceFigures: Record<string, unknown> | null;
}

interface ReportPage {
  items: ReportView[];
  nextCursor: string | null;
}

const FIGURES = {
  planned: 520,
  actual: 498.5,
  shortfall: 21.5,
  uom: 't',
  status: 'REPORTED',
  quality: 'GOOD',
  plant: 'HDPE',
  eventType: 'pla_daily',
  topic: 'marun/hdpe/pla',
};

/**
 * MQTT PLA feed (plans/MQTT_FEEDS.md): an external record keeps the connection that delivered it and the
 * source's own figures (comparison only); GET /external-production-reports lists records newest local
 * production date first in keyset pages, filtered by connection, under the unit scope of GET :id.
 */
describe('external production reports: source figures and list (MQTT PLA)', () => {
  const env = new ActualsWorld();
  let service: ExternalReportsService;

  const draft = (
    id: string,
    day: string,
    overrides: Partial<ExternalReportDraft> = {},
  ): ExternalReportDraft => ({
    externalReportId: id,
    externalRevision: '1',
    siteId: null,
    localProductionDate: day,
    timezone: null,
    utcStart: new Date(`${day}T02:30:00.000Z`),
    utcEnd: new Date(
      new Date(`${day}T02:30:00.000Z`).getTime() + 24 * 3600_000,
    ),
    basis: 'good',
    sourceStatus: 'REPORTED',
    sourceSystem: 'MQTT',
    approvedAtSource: null,
    evidenceRef: null,
    lines: [
      {
        unitId: env.world.unitA1,
        productId: env.products.p1,
        gross: null,
        good: '498.5',
        reject: null,
        uom: 't',
      },
    ],
    connectionId: env.connections.mqtt,
    sourceFigures: FIGURES,
    ...overrides,
  });

  const importer = () => ({ tenantId: env.world.tenantA, userId: null });

  beforeAll(async () => {
    await env.start();
    service = env.app.get(ExternalReportsService);
  });
  afterAll(() => env.stop());

  it('stores and returns the connection and the source figures', async () => {
    const { report, outcome } = await service.importOne(
      importer(),
      draft('pla:1', '2027-03-01'),
    );
    expect(outcome).toBe('imported');
    const view = (
      await env.get(`external-production-reports/${report.id}`).expect(200)
    ).body as ReportView;
    expect(view.connectionId).toBe(env.connections.mqtt);
    expect(view.sourceFigures).toEqual(FIGURES);
  });

  it('same revision: equal figures are a duplicate, other figures a conflict', async () => {
    const again = await service.importOne(
      importer(),
      draft('pla:1', '2027-03-01', {
        sourceFigures: { ...FIGURES, topic: 'marun/hdpe/pla' },
      }),
    );
    expect(again.outcome).toBe('duplicate');
    await expect(
      service.importOne(
        importer(),
        draft('pla:1', '2027-03-01', {
          sourceFigures: { ...FIGURES, shortfall: 30 },
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists by connection, newest production date first, in keyset pages', async () => {
    await service.importOne(importer(), draft('pla:2', '2027-03-03'));
    await service.importOne(importer(), draft('pla:3', '2027-03-02'));
    await service.importOne(
      importer(),
      draft('api:1', '2027-03-04', {
        connectionId: null,
        sourceFigures: null,
        sourceSystem: null,
      }),
    );
    const path = `external-production-reports?connectionId=${env.connections.mqtt}`;
    const all = (await env.get(path).expect(200)).body as ReportPage;
    expect(all.items.map((r) => r.externalReportId)).toEqual([
      'pla:2',
      'pla:3',
      'pla:1',
    ]);
    expect(all.nextCursor).toBeNull();
    const first = (await env.get(`${path}&limit=1`).expect(200))
      .body as ReportPage;
    expect(first.items.map((r) => r.externalReportId)).toEqual(['pla:2']);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = (
      await env
        .get(
          `${path}&limit=1&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
        )
        .expect(200)
    ).body as ReportPage;
    expect(second.items.map((r) => r.externalReportId)).toEqual(['pla:3']);
    const unfiltered = (
      await env.get('external-production-reports').expect(200)
    ).body as ReportPage;
    expect(unfiltered.items[0].externalReportId).toBe('api:1');
    expect(unfiltered.items[0].sourceFigures).toBeNull();
  });

  it('unit-limited callers see records of their units only; other tenants nothing', async () => {
    const otherUnit = await env.unitUser(env.world.unitA2);
    const own = await env.unitUser(env.world.unitA1);
    const hidden = (
      await env.get('external-production-reports', otherUnit).expect(200)
    ).body as ReportPage;
    expect(hidden.items).toEqual([]);
    const visible = (
      await env.get('external-production-reports', own).expect(200)
    ).body as ReportPage;
    expect(visible.items).toHaveLength(4);
    const foreign = (
      await env.get('external-production-reports', env.adminB).expect(200)
    ).body as ReportPage;
    expect(foreign.items).toEqual([]);
  });

  it('refuses invalid filters (422 validation)', async () => {
    await env.get('external-production-reports?state=open').expect(422);
    await env.get('external-production-reports?connectionId=x').expect(422);
  });
});
