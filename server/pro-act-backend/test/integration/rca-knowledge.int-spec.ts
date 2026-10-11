import { KnowledgeBody, KnowledgeWorld } from './support/knowledge-world';

interface ApiError {
  code: string;
}

/**
 * v2 RCA knowledge base (owner decision 2026-10-12) on real Postgres: the entry a closed case writes,
 * server-side search / filters / keyset paging with tenant isolation (the scoped predicate is in the
 * SQL), the server-computed quality score, one vote per user (repeat and replay change nothing),
 * publish / unpublish roles with If-Match, and similar past cases of an event.
 */
describe('RCA knowledge base v2', () => {
  const env = new KnowledgeWorld();
  let k1 = '';
  let caseId = '';
  let k2 = '';
  let k3 = '';
  let k4 = '';
  let kNoUnit = '';
  let kB = '';

  beforeAll(async () => {
    await env.start();
    ({ caseId, entryId: k1 } = await env.closedCaseEntry());
    const { unitA1, unitA2, assetA1, tenantB } = env.world;
    k2 = await env.entry({
      title: 'Seal leak on pump',
      unitId: unitA2,
      rootCause: 'Worn seal',
      published: true,
      createdAt: '2026-09-02T00:00:00Z',
    });
    k3 = await env.entry({
      title: 'Seal leak again',
      unitId: unitA2,
      createdAt: '2026-09-01T00:00:00Z',
    });
    k4 = await env.entry({
      title: 'Extruder bearing',
      unitId: unitA1,
      assetId: assetA1,
      createdAt: '2026-08-01T00:00:00Z',
    });
    kNoUnit = await env.entry({
      title: 'Site-wide steam loss',
      createdAt: '2026-07-01T00:00:00Z',
    });
    kB = await env.entry({
      title: 'Coupling misalignment elsewhere',
      tenantId: tenantB,
      rootCause: 'Coupling misalignment',
    });
  });
  afterAll(() => env.stop());

  const ids = (items: KnowledgeBody[]) => items.map((item) => item.id);

  describe('list', () => {
    it('lists the tenant entries newest first with the tenant predicate in the SQL', async () => {
      env.sql.length = 0;
      const page = await env.page('limit=50');
      expect(ids(page.items)).toEqual([k1, k2, k3, k4, kNoUnit]);
      expect(page.scope.tenantId).toBe(env.world.tenantA);
      expect(
        env.sql.some((s) =>
          /FROM "rca_knowledge_base" "kb" WHERE "kb"\."tenant_id" = \$1/.test(
            s,
          ),
        ),
      ).toBe(true);
      expect(ids((await env.page('limit=50', env.adminB)).items)).toEqual([kB]);
    });

    it('searches title, root cause and problem text on the server', async () => {
      expect(ids((await env.page('q=coupling')).items)).toEqual([k1]);
      expect(ids((await env.page('q=worn%20SEAL')).items)).toEqual([k2]);
      expect(ids((await env.page('q=trips%20on%20vibration')).items)).toEqual([
        k1,
      ]);
      expect(ids((await env.page('q=100%25')).items)).toEqual([]);
    });

    it('filters by unit, asset (entry or linked event), reason of a linked event, published and window', async () => {
      const { unitA2, assetA1, reasonR1, reasonR2 } = env.world;
      expect(ids((await env.page(`unitId=${unitA2}`)).items)).toEqual([k2, k3]);
      expect(ids((await env.page(`assetId=${assetA1}`)).items)).toEqual([
        k1,
        k4,
      ]);
      expect(ids((await env.page(`reasonCodeId=${reasonR1}`)).items)).toEqual([
        k1,
      ]);
      expect(ids((await env.page(`reasonCodeId=${reasonR2}`)).items)).toEqual(
        [],
      );
      expect(ids((await env.page('published=true')).items)).toEqual([k2]);
      expect(ids((await env.page('published=false&q=seal')).items)).toEqual([
        k3,
      ]);
      const window = 'from=2026-08-15T00:00:00Z&to=2026-09-02T00:00:00Z';
      expect(ids((await env.page(window)).items)).toEqual([k3]);
      const bad = await env
        .get('rca-knowledge?from=2026-09-02T00:00:00Z&to=2026-09-01T00:00:00Z')
        .expect(422);
      expect((bad.body as ApiError).code).toBe('INVALID_RANGE');
    });

    it('keyset pages stay complete and stable while an entry is inserted', async () => {
      const first = await env.page('limit=2');
      expect(ids(first.items)).toEqual([k1, k2]);
      expect(first.nextCursor).toBeTruthy();
      const inserted = await env.entry({ title: 'Brand new' });
      const seen = [...ids(first.items)];
      let cursor = first.nextCursor;
      while (cursor) {
        const next = await env.page(
          `limit=2&cursor=${encodeURIComponent(cursor)}`,
        );
        seen.push(...ids(next.items));
        cursor = next.nextCursor;
      }
      expect(seen).toEqual([k1, k2, k3, k4, kNoUnit]);
      expect(ids((await env.page('limit=1')).items)).toEqual([inserted]);
      await env.rows(`DELETE FROM rca_knowledge_base WHERE id = $1`, [
        inserted,
      ]);
      await env.get('rca-knowledge?cursor=garbage').expect(400);
      await env.get('rca-knowledge?limit=501').expect(422);
    });

    it('rejects a tenantId parameter and anonymous callers; a unit-limited user sees its units only', async () => {
      const refused = await env
        .get(`rca-knowledge?tenantId=${env.world.tenantB}`)
        .expect(400);
      expect((refused.body as ApiError).code).toBe('TENANT_FROM_IDENTITY');
      await env.get('rca-knowledge', '').expect(401);
      const limited = await env.page('limit=50', env.reliabilityA2);
      expect(ids(limited.items)).toEqual([k2, k3]);
      expect(limited.scope.unitIds).toEqual([env.world.unitA2]);
    });
  });

  describe('detail and score', () => {
    it('carries the case, names, recommendations and the server-side quality score', async () => {
      const response = await env.get(`rca-knowledge/${k1}`).expect(200);
      const body = response.body as KnowledgeBody;
      expect(response.headers.etag).toBe(`"${body.rowVersion}"`);
      expect(body).toMatchObject({
        rcaId: caseId,
        caseTitle: 'Extruder coupling failures',
        caseStatus: 'Closed',
        unitId: env.world.unitA1,
        assetName: 'Extruder',
        recommendations: ['Align the coupling after every seal change'],
        isPublished: false,
      });
      // root cause 30 + problem 15 + recommendation 10 + scope 10 + linked case 5 (no actions, no votes)
      expect(body.qualityScore).toBe(70);
      expect(body.quality.reduce((sum, part) => sum + part.points, 0)).toBe(70);
      expect(
        (
          (await env.get(`rca-knowledge/${kNoUnit}`).expect(200))
            .body as KnowledgeBody
        ).qualityScore,
      ).toBe(0);
    });

    it('answers 404 for a foreign or out-of-scope entry', async () => {
      await env.get(`rca-knowledge/${k1}`, env.adminB).expect(404);
      await env.get(`rca-knowledge/${k1}`, env.reliabilityA2).expect(404);
      await env.get('rca-knowledge/not-a-uuid').expect(400);
    });
  });

  describe('votes', () => {
    const helpfulVotes = async (id: string) =>
      (
        await env.rows<{ helpful_votes: number }>(
          `SELECT helpful_votes FROM rca_knowledge_base WHERE id = $1`,
          [id],
        )
      )[0].helpful_votes;

    it('keeps one vote per user: repeats change nothing, a change replaces it, replays are replayed', async () => {
      const vote = (
        helpful: boolean,
        options: { token?: string; key?: string } = {},
      ) => env.post(`rca-knowledge/${k1}/votes`, { helpful }, options);
      const first = await vote(true, { key: 'vote-1' }).expect(200);
      expect(first.body).toMatchObject({
        helpfulCount: 1,
        notHelpfulCount: 0,
        myVote: 'helpful',
      });
      await vote(true).expect(200);
      expect(await helpfulVotes(k1)).toBe(1);
      const replay = await vote(true, { key: 'vote-1' }).expect(200);
      expect(replay.headers['idempotent-replayed']).toBe('true');
      const changed = await vote(false).expect(200);
      expect(changed.body).toMatchObject({
        helpfulCount: 0,
        notHelpfulCount: 1,
        myVote: 'not_helpful',
      });
      expect(await helpfulVotes(k1)).toBe(-1);
      const other = await vote(true, { token: env.operator }).expect(200);
      expect(other.body).toMatchObject({
        helpfulCount: 1,
        notHelpfulCount: 1,
        myVote: 'helpful',
      });
      const stored = await env.rows(
        `SELECT 1 FROM rca_knowledge_votes WHERE entry_id = $1`,
        [k1],
      );
      expect(stored).toHaveLength(2);
      expect(
        (
          (await env.get(`rca-knowledge/${k1}`).expect(200))
            .body as KnowledgeBody
        ).myVote,
      ).toBe('not_helpful');
    });

    it('refuses foreign entries and non-boolean votes', async () => {
      await env
        .post(
          `rca-knowledge/${k1}/votes`,
          { helpful: true },
          { token: env.adminB },
        )
        .expect(404);
      await env
        .post(`rca-knowledge/${k1}/votes`, { helpful: 'yes' })
        .expect(422);
    });
  });

  describe('publish / unpublish', () => {
    const etagOf = async (id: string) =>
      `"${((await env.get(`rca-knowledge/${id}`).expect(200)).body as KnowledgeBody).rowVersion}"`;

    it('is refused to roles that are not RCA writers', async () => {
      const ifMatch = await etagOf(k1);
      for (const token of [env.operator, env.analyst]) {
        const refused = await env
          .post(`rca-knowledge/${k1}/publish`, {}, { token, ifMatch })
          .expect(403);
        expect((refused.body as ApiError).code).toBe('FORBIDDEN_ROLE');
      }
    });

    it('needs If-Match, answers 412 when stale and moves the row version', async () => {
      await env.post(`rca-knowledge/${k1}/publish`, {}).expect(428);
      const ifMatch = await etagOf(k1);
      const published = await env
        .post(`rca-knowledge/${k1}/publish`, {}, { ifMatch })
        .expect(200);
      const body = published.body as KnowledgeBody;
      expect(body).toMatchObject({
        isPublished: true,
        publishedBy: env.adminUserId,
      });
      expect(published.headers.etag).toBe(`"${body.rowVersion}"`);
      const stale = await env
        .post(`rca-knowledge/${k1}/unpublish`, {}, { ifMatch })
        .expect(412);
      expect((stale.body as ApiError).code).toBe('STALE_REVISION');
      const again = await env
        .post(
          `rca-knowledge/${k1}/publish`,
          {},
          { ifMatch: `"${body.rowVersion}"` },
        )
        .expect(200);
      expect((again.body as KnowledgeBody).rowVersion).toBe(body.rowVersion);
      const withdrawn = await env
        .post(
          `rca-knowledge/${k1}/unpublish`,
          {},
          { ifMatch: `"${body.rowVersion}"` },
        )
        .expect(200);
      expect(withdrawn.body).toMatchObject({
        isPublished: false,
        publishedBy: null,
      });
    });

    it('lets a unit-limited reliability engineer publish entries of its units only', async () => {
      const token = env.reliabilityA2;
      const ifMatch = await etagOf(k3);
      await env
        .post(`rca-knowledge/${k3}/publish`, {}, { token, ifMatch })
        .expect(200);
      await env
        .post(
          `rca-knowledge/${k1}/publish`,
          {},
          { token, ifMatch: await etagOf(k1) },
        )
        .expect(404);
      await env
        .post(
          `rca-knowledge/${k3}/unpublish`,
          {},
          { token, ifMatch: await etagOf(k3) },
        )
        .expect(200);
    });
  });

  describe('similar past cases', () => {
    it('ranks entries by asset, reason and unit of the event; published first among equals', async () => {
      const response = await env
        .get(`rca-knowledge/similar?eventId=${env.world.events.e3}`)
        .expect(200);
      const items = response.body as KnowledgeBody[];
      expect(ids(items)).toEqual([k1, k2, k3]);
      expect(items.map((item) => [item.matchedOn, item.relevance])).toEqual([
        [['reason'], 2],
        [['unit'], 1],
        [['unit'], 1],
      ]);
      const limited = await env
        .get(`rca-knowledge/similar?eventId=${env.world.events.e3}&limit=1`)
        .expect(200);
      expect(ids(limited.body as KnowledgeBody[])).toEqual([k1]);
    });

    it("leaves out the event's own case and matches asset + unit", async () => {
      const response = await env
        .get(`rca-knowledge/similar?eventId=${env.world.events.e1}`)
        .expect(200);
      const items = response.body as KnowledgeBody[];
      expect(ids(items)).toEqual([k4]);
      expect(items[0]).toMatchObject({
        matchedOn: ['asset', 'unit'],
        relevance: 4,
      });
    });

    it('answers 404 for a foreign or out-of-scope event', async () => {
      await env
        .get(`rca-knowledge/similar?eventId=${env.world.events.eB1}`)
        .expect(404);
      await env
        .get(
          `rca-knowledge/similar?eventId=${env.world.events.e1}`,
          env.reliabilityA2,
        )
        .expect(404);
      await env.get('rca-knowledge/similar').expect(422);
    });
  });
});
