import { randomUUID } from 'crypto';
import { KnowledgeBody, KnowledgeWorld } from './support/knowledge-world';

interface SharedBody {
  items: Array<Record<string, unknown> & { id: string; sourcePlant: string; lessonStatus: string }>;
}

/**
 * SME CA9 and RCA-08 on real Postgres: lessons another plant of the same organization published and shared
 * are readable (redacted, read-only, with their status); unshared, unpublished and other organizations'
 * lessons never are; sharing needs a published entry and a manager approver; unpublishing withdraws it.
 * Similar past cases rank the event's failure mode first and match words of the event's text.
 */
describe('RCA lessons between plants (SME CA9) and similarity by failure mode (RCA-08)', () => {
  const env = new KnowledgeWorld();
  let kA = '';
  let kShared = '';
  let kForeign = '';
  let kMode = '';

  const shared = async (token = env.admin) =>
    (await env.get('rca-knowledge/shared', token).expect(200)).body as SharedBody;
  const etagOf = async (id: string) =>
    `"${((await env.get(`rca-knowledge/${id}`).expect(200)).body as KnowledgeBody).rowVersion}"`;

  async function otherOrganizationTenant(): Promise<string> {
    const organization = randomUUID();
    const tenant = randomUUID();
    await env.rows(`INSERT INTO organizations (id, code, name, is_active) VALUES ($1, $2, 'Other group', true)`, [
      organization,
      `ORG-${organization.slice(0, 8)}`,
    ]);
    await env.rows(
      `INSERT INTO tenants (id, code, name, organization_id, is_active) VALUES ($1, $2, 'Other group plant', $3, true)`,
      [tenant, `TEN-${tenant.slice(0, 8)}`, organization],
    );
    return tenant;
  }

  async function share(id: string, lessonStatus: string): Promise<void> {
    await env.rows(
      `UPDATE rca_knowledge_base SET share_scope = 'organization', shared_at = now(), lesson_status = $2,
              failure_mode = 'Seal leak', is_published = true WHERE id = $1`,
      [id, lessonStatus],
    );
  }

  beforeAll(async () => {
    await env.start();
    const { tenantB, unitA2 } = env.world;
    kA = await env.entry({ title: 'Seal flush improvement', unitId: unitA2, rootCause: 'Flush plan too weak' });
    kShared = await env.entry({ title: 'Seal material trial failed', tenantId: tenantB, rootCause: 'Wrong elastomer' });
    await share(kShared, 'caution');
    const notShared = await env.entry({ title: 'Plant B internal', tenantId: tenantB, published: true });
    await env.rows(`UPDATE rca_knowledge_base SET failure_mode = 'x' WHERE id = $1`, [notShared]);
    kForeign = await env.entry({ title: 'Other group lesson', tenantId: await otherOrganizationTenant() });
    await share(kForeign, 'verified_practice');
    kMode = await env.entry({ title: 'Pump leak history', unitId: env.world.unitA1 });
    await env.rows(`UPDATE rca_knowledge_base SET failure_mode = 'SEAL  leak' WHERE id = $1`, [kMode]);
  });
  afterAll(() => env.stop());

  it('reads only the lessons other plants of the organization shared, redacted, with their status', async () => {
    const page = await shared();
    expect(page.items.map((item) => item.id)).toEqual([kShared]);
    expect(page.items[0]).toMatchObject({
      sourcePlant: 'Tenant B',
      title: 'Seal material trial failed',
      rootCause: 'Wrong elastomer',
      lessonStatus: 'caution',
      failureMode: 'Seal leak',
    });
    for (const hidden of ['assetId', 'unitId', 'rcaId', 'author', 'publishedBy']) {
      expect(page.items[0]).not.toHaveProperty(hidden);
    }
    expect(page.items.map((item) => item.id)).not.toContain(kForeign);
  });

  it('sharing needs a published entry and a manager approver; unpublishing withdraws it', async () => {
    const draft = await env.post(`rca-knowledge/${kA}/share`, {}, { ifMatch: await etagOf(kA) }).expect(409);
    expect((draft.body as { code: string }).code).toBe('NOT_PUBLISHED');
    await env.post(`rca-knowledge/${kA}/publish`, {}, { ifMatch: await etagOf(kA) }).expect(200);
    await env
      .post(`rca-knowledge/${kA}/share`, {}, { token: env.reliabilityA2, ifMatch: await etagOf(kA) })
      .expect(403);
    const sharedEntry = await env.post(`rca-knowledge/${kA}/share`, {}, { ifMatch: await etagOf(kA) }).expect(200);
    expect(sharedEntry.body).toMatchObject({ shareScope: 'organization', lessonStatus: 'unverified' });
    expect((await shared(env.adminB)).items.map((item) => item.id)).toEqual([kA]);
    await env.post(`rca-knowledge/${kA}/unpublish`, {}, { ifMatch: await etagOf(kA) }).expect(200);
    expect((await shared(env.adminB)).items).toEqual([]);
  });

  it('RCA-08: the same failure mode ranks first; words of the event text match too', async () => {
    await env.rows(`UPDATE production_events SET failure_mode = 'Seal Leak', description = 'flush pressure low' WHERE id = $1`, [
      env.world.events.e3,
    ]);
    const items = (await env.get(`rca-knowledge/similar?eventId=${env.world.events.e3}`).expect(200))
      .body as KnowledgeBody[];
    expect(items[0].id).toBe(kMode);
    expect(items[0].matchedOn).toEqual(expect.arrayContaining(['failure_mode', 'text']));
    const flush = items.find((item) => item.id === kA);
    expect(flush?.matchedOn).toEqual(expect.arrayContaining(['text']));
  });
});
