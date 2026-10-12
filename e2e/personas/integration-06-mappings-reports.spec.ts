import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { apiLogin, call, command, DEMO_UNIT_CODE, INT_USERS, loadState, newSuffix, openConsole, PREFIX, uiLogin, unitByCode, type IntSession, type IntState } from './support/integration-world';

/**
 * INTEGRATION ADMIN persona — journeys 7 (mappings) and 10 (external report import) as Freya.
 * A source mapping rule `P-INT-…` (topic pattern of the persona's namespace → the demo unit) is
 * created through the v2 API and shown on the console's Source mappings tab; an attribute-mapping
 * override version with an alias is created and previewed on a sample record. There is no screen for
 * external daily-production reports (REPORT_IMPORTERS), so the import is exercised through the API:
 * one JSON record is stored, a CSV import is accepted with 202 and a job, a malformed body is 400.
 */
const suffix = newSuffix();
let state: IntState;
let freya: IntSession;
let unit: { id: string; name: string };

test.describe.configure({ mode: 'serial', timeout: 180_000 });

interface MappingRow {
  id: string;
  matchKind: string;
  matchValue: string;
  targetId: string;
  sourceSystem: string;
  isActive: boolean;
}

const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

test.describe('Integration admin — mappings and report import', () => {
  test.beforeAll(async () => {
    state = loadState();
    freya = await apiLogin(INT_USERS.freya);
    unit = await unitByCode(freya.token, DEMO_UNIT_CODE);
  });

  test('INT-07a (freya): a source mapping rule for the persona namespace is created and listed on the Source mappings tab', async ({ page }) => {
    const matchValue = `${state.namespace}/HDPE/Polymer/Line1/*/events`;
    const created = await command<MappingRow & { code?: string }>(freya.token, '/v2/source-mappings', {
      matchKind: 'pattern',
      matchValue,
      targetType: 'unit',
      targetId: unit.id,
      sourceSystem: 'MQTT',
      precedence: 0,
      connectionId: state.connectionId,
      description: `${PREFIX}placement-${suffix}`,
    });
    // a re-run of this spec meets its own rule from the first attempt: 409 MAPPING_EXISTS, never a second row
    expect([201, 409], JSON.stringify(created.body)).toContain(created.status);
    if (created.status === 409) expect(created.body.code).toBe('MAPPING_EXISTS');
    const listed = await call<{ items: MappingRow[] }>(freya.token, 'GET', '/v2/source-mappings?limit=500');
    const rule = listed.body.items.find((row) => row.matchValue === matchValue && row.isActive);
    expect(rule, 'the rule is listed').toBeDefined();
    expect(rule?.targetId).toBe(unit.id);
    expect(rule?.sourceSystem).toBe('MQTT');
    if (created.status === 201) expect(rule?.id).toBe(created.body.id);

    // validation: an unknown target unit is refused with the field error, nothing stored
    const invalid = await command<{ code: string }>(freya.token, '/v2/source-mappings', {
      matchKind: 'pattern',
      matchValue: `${state.namespace}/invalid/*/events`,
      targetType: 'unit',
      targetId: '00000000-0000-4000-8000-000000000000',
      sourceSystem: 'MQTT',
    });
    expect([404, 422]).toContain(invalid.status);

    await uiLogin(page, INT_USERS.freya);
    await openConsole(page);
    await page.getByTestId('tab-mappings').click();
    // the rules are paged (20 per page, oldest first): narrow to patterns and page forward to the new rule
    await page.locator('#mappings-kind').selectOption('pattern');
    const link = page.locator(`[data-testid="source-mapping"][data-match="${matchValue}"]`);
    const row = page.getByRole('row').filter({ has: link });
    await expect(async () => {
      if ((await link.count()) === 0) await page.getByRole('button', { name: 'Next page' }).click();
      await expect(link).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 60_000 });
    await expect(row).toContainText('Pattern');
    await expect(row).toContainText(unit.name);
    await expect(row).toContainText(state.connectionName);
    await page.screenshot({ path: test.info().outputPath('int-07a-source-mappings.png'), fullPage: true });
  });

  test('INT-07b (freya): an attribute-mapping override with an alias is created and a sample record is previewed through it', async () => {
    const templateName = `${PREFIX}Template-${suffix}`;
    const fieldRules = [
      { sourceAttr: 'ReasonCode', aliases: ['P-INT Reason'], targetField: 'reason', type: 'digital' },
      { sourceAttr: 'Quantity', targetField: 'quantity', type: 'number' },
      { sourceAttr: 'Duration', targetField: 'suppliedDurationSeconds', type: 'duration', unit: 'timespan' },
    ];
    const version = await command<{ id: string; templateName: string; code?: string }>(freya.token, '/v2/attribute-mappings', { templateName, fieldRules });
    expect(version.status, JSON.stringify(version.body)).toBe(201);
    expect(version.body.templateName).toBe(templateName);

    const effective = await call<Array<{ templateName: string; rules?: unknown[] }>>(freya.token, 'GET', '/v2/attribute-mappings');
    expect(effective.status).toBe(200);
    expect(JSON.stringify(effective.body)).toContain(templateName);

    const now = Date.now(); // one clock reading: the preview's duration is end − start to the millisecond
    const start = new Date(now - 3_600_000).toISOString();
    const end = new Date(now - 2_700_000).toISOString();
    const preview = await call<{ templateName: string; columns: Record<string, unknown>; facts: Record<string, unknown>; diagnostics: unknown[]; durationSeconds: number | null }>(
      freya.token,
      'POST',
      '/v2/attribute-mappings/preview',
      { templateName, attributes: { 'P-INT Reason': 'MECH-01', Quantity: 7, Duration: '00:15:00' }, startTime: start, endTime: end },
    );
    expect(preview.status, JSON.stringify(preview.body)).toBe(200);
    expect(preview.body.templateName).toBe(templateName);
    expect(preview.body.durationSeconds).toBe(900);
    const mapped = JSON.stringify({ columns: preview.body.columns, facts: preview.body.facts });
    expect(mapped).toContain('MECH-01');
    expect(mapped).toContain('7');
    expect(preview.body.diagnostics).toEqual([]);

    // validation: a rule on a field the catalog does not know is refused
    const invalid = await command<{ code: string }>(freya.token, '/v2/attribute-mappings', { templateName, fieldRules: [{ sourceAttr: 'X', targetField: 'noSuchField', type: 'string' }] });
    expect(invalid.status).toBe(422);
    expect(invalid.body.code).toBe('INVALID_FIELD_RULES');
  });

  test('INT-10 (freya): an external daily-production report is imported (JSON stored, CSV accepted with 202); a malformed one is 400', async () => {
    const products = await call<{ items: Array<{ id: string; isActive: boolean }> }>(freya.token, 'GET', '/v2/products?limit=50');
    expect(products.status).toBe(200);
    const product = products.body.items.find((item) => item.isActive) ?? products.body.items[0];
    expect(product, 'Demo Plant has a product').toBeDefined();
    const day = isoDay(-1);
    const record = {
      externalReportId: `${PREFIX}RPT-${suffix}`,
      externalRevision: '1',
      localProductionDate: day,
      timezone: 'UTC',
      utcStart: `${day}T00:00:00Z`,
      utcEnd: `${isoDay(0)}T00:00:00Z`,
      basis: 'gross',
      sourceStatus: 'COMPLETED',
      evidenceRef: `${PREFIX}evidence-${suffix}`,
      lines: [{ unitId: unit.id, productId: product.id, gross: '120.5', good: '118', reject: '2.5', uom: 't' }],
    };
    const stored = await command<{ id: string; outcome?: string; externalReportId: string; code?: string }>(freya.token, '/v2/external-production-reports', record);
    // a re-run sends the same id + revision + content again: stored once, reported as a duplicate, never summed
    expect([200, 201], JSON.stringify(stored.body)).toContain(stored.status);
    expect(stored.body.externalReportId).toBe(record.externalReportId);
    const read = await call<{ externalReportId: string; state?: string }>(freya.token, 'GET', `/v2/external-production-reports/${stored.body.id}`);
    expect(read.status).toBe(200);
    expect(read.body.externalReportId).toBe(record.externalReportId);

    const csv = [
      'externalReportId,externalRevision,localProductionDate,utcStart,utcEnd,basis,sourceStatus,unitId,productId,gross,good,reject,uom',
      `${PREFIX}CSV-${suffix},1,${day},${day}T00:00:00Z,${isoDay(0)}T00:00:00Z,gross,COMPLETED,${unit.id},${product.id},80,78,2,t`,
    ].join('\n');
    const accepted = await command<{ jobId: string; statusUrl: string }>(freya.token, '/v2/external-production-reports/import', { csv });
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(202);
    expect(accepted.body.jobId).toBeTruthy();
    await expect.poll(async () => (await call<{ status: string; state?: string }>(freya.token, 'GET', `/v2/actuals-jobs/${accepted.body.jobId}`)).status, { intervals: [2_000], timeout: 30_000 }).toBe(200);

    // v2 convention (api-exception.filter): DTO failures are 422 VALIDATION_FAILED with one message per field, an
    // unparsable body is 400 BAD_REQUEST; neither stores anything
    const invalid = await command<{ code: string; message?: string[] }>(freya.token, '/v2/external-production-reports', { externalReportId: `${PREFIX}BAD-${suffix}`, basis: 'net' });
    expect(invalid.status).toBe(422);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
    expect(invalid.body.message?.some((line) => line.includes('basis must be one of'))).toBe(true);
    const malformed = await fetch(`${process.env.VITE_API_BASE_URL || 'http://localhost:4004/api'}/v2/external-production-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freya.token}`, 'Idempotency-Key': randomUUID() },
      body: '{"externalReportId": 5',
    });
    expect(malformed.status).toBe(400);
    expect(((await malformed.json()) as { code: string }).code).toBe('BAD_REQUEST');
    const noKey = await call<{ code: string }>(freya.token, 'POST', '/v2/external-production-reports', record);
    expect(noKey.status).toBe(428);
    expect(noKey.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });
});
