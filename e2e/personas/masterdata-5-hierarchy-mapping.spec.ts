import { test, expect } from '@playwright/test';
import { api, itemsOf } from './support/manager-api';
import { MDA, PREFIX, listMdaUnits, sessionOf, shortId, type Session } from './support/masterdata-world';

/**
 * Master data admin persona — journey 7, hierarchy mappings. The only hierarchy-mapping screen lives
 * under Connectivity (SuperAdmin only, owner 18 Oct 2026), so the persona has no screen for it; the v1 API is checked
 * instead: a `P-MDA-map-…` mapping of a persona unit is created (the controller declares no @Roles) and
 * previewed through `POST /hierarchy-mappings/find-mapping`. A PI mapping resolves, and so does the MQTT one
 * (mirrored into /v2/source-mappings and looked up by the request's source system; formerly a defect of the
 * PI-only default, fixed in 3a61aa3). Not serial: a retry of this test must not re-run the other journeys.
 * Nothing is deleted.
 */
let felix: Session;
const suffix = shortId();

test.describe('Master data admin — hierarchy mappings through the v1 API', () => {
  test.beforeAll(async () => {
    felix = await sessionOf(MDA.felix);
  });

  test('MDA-07b Felix: a P-MDA mapping is created and previewed; PI and MQTT previews both resolve', async () => {
    const units = await listMdaUnits(felix.token, 'U');
    expect(units.length, 'a P-MDA-U- unit of masterdata-1 exists').toBeGreaterThan(0);
    const mapping = (sourceType: string, kind: string) =>
      api<{ id?: string; code?: string }>(felix.token, 'POST', '/hierarchy-mappings', { sourceType, sourceIdentifier: `${PREFIX}map-${kind}/${suffix}`, targetType: 'unit', targetId: units[0].id, tenantId: felix.tenantId });
    const preview = (sourceType: string, kind: string) =>
      api<{ unitId?: string } | undefined>(felix.token, 'POST', '/hierarchy-mappings/find-mapping', { sourceType, sourceIdentifier: `${PREFIX}map-${kind}/${suffix}`, tenantId: felix.tenantId });
    const pi = await mapping('PI', 'pi');
    expect(pi.status).toBe(201); // the controller declares no @Roles: any member of the plant may write
    const piPreview = await preview('PI', 'pi');
    expect(piPreview.status).toBeLessThan(300);
    expect(piPreview.body?.unitId).toBe(units[0].id);

    const mqtt = await mapping('MQTT', 'mqtt');
    expect(mqtt.status).toBe(201);
    const mirrored = await api<{ items: Array<{ sourceSystem: string; matchValue: string; isActive: boolean }> }>(felix.token, 'GET', '/v2/source-mappings?limit=200');
    expect(itemsOf(mirrored.body).find((row) => row.matchValue === `${PREFIX}map-mqtt/${suffix}`)).toMatchObject({ sourceSystem: 'MQTT', isActive: true });
    const mqttPreview = await preview('MQTT', 'mqtt');
    expect(mqttPreview.status).toBeLessThan(300);
    // formerly failing: find-mapping defaulted the source system to PI and never found the mirrored MQTT mapping
    expect(mqttPreview.body?.unitId).toBe(units[0].id);
  });
});
