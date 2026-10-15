import { randomUUID } from 'crypto';
import { rmSync } from 'fs';
import { join } from 'path';
import { UPLOAD_ROOT } from '../../src/common/http/upload-options';
import { ApiError } from './support/plan-world';
import { CaseBody, RcaWorld } from './support/rca-world';
import { bearer } from './support/test-app';

interface ToolBody {
  id: string;
  rowVersion: number;
  causes?: Array<{
    rpn: number | null;
    actionPriority: string | null;
    missing: string[];
  }>;
  complete?: boolean;
  rpnThreshold?: number;
}

interface CaseView extends CaseBody {
  teamCharter: string | null;
  eventDiagram: {
    nodes: Array<{ id: string; label: string }>;
    edges: unknown[];
  };
  templateId: string | null;
}

/**
 * The v2 RCA workspace on real Postgres (v1 parity): analysis tool records with create-or-replace and
 * If-Match, the extended case content (evidence form, charter, event diagram), list filters and summary,
 * template trees, delete rules and evidence files — each in the caller's tenant and units only.
 */
describe('RCA workspace (analysis tools, evidence files, case commands)', () => {
  const env = new RcaWorld();
  let caseId = '';
  const uploaded: string[] = [];

  beforeAll(async () => {
    await env.start();
    caseId = (await env.createCase(env.example())).id;
  });
  afterAll(async () => {
    for (const name of uploaded)
      rmSync(join(UPLOAD_ROOT, env.world.tenantA.toLowerCase(), name), {
        force: true,
      });
    await env.stop();
  });

  const put = (
    path: string,
    body: object,
    etag?: string,
    token = env.admin,
  ) => {
    const call = env
      .http()
      .put(`/api/v2/${path}`)
      .set(bearer(token))
      .send(body);
    return etag ? call.set('If-Match', etag) : call;
  };
  const del = (path: string, etag: string, token = env.admin) =>
    env
      .http()
      .delete(`/api/v2/${path}`)
      .set(bearer(token))
      .set('If-Match', etag);
  const read = async (id: string) =>
    (await env.get(`rcas/${id}`).expect(200)).body as CaseView;

  describe('analysis tools', () => {
    const fiveWhy = {
      problem: 'Pump trips',
      whyLevels: [{ level: 1, question: 'Why?', answer: 'Seal leak' }],
      rootCause: 'Seal',
    };

    it('starts empty, saves the first record without If-Match and refuses a blind second save', async () => {
      const empty = (await env.get(`rcas/${caseId}/analyses`).expect(200))
        .body as Record<string, unknown>;
      expect(empty).toEqual({
        fiveWhy: null,
        fishbone: null,
        fmea: null,
        faultTree: null,
        barrier: null,
        change: null,
      });
      const first = (
        await put(`rcas/${caseId}/analyses/five-why`, fiveWhy).expect(200)
      ).body as ToolBody;
      expect(first.rowVersion).toBe(1);
      const blind = await put(
        `rcas/${caseId}/analyses/five-why`,
        fiveWhy,
      ).expect(412);
      expect((blind.body as ApiError).code).toBe('STALE_REVISION');
      const second = await put(
        `rcas/${caseId}/analyses/five-why`,
        { ...fiveWhy, rootCause: 'Wrong seal' },
        '"1"',
      ).expect(200);
      expect(second.headers.etag).toBe('"2"');
      await put(`rcas/${caseId}/analyses/five-why`, fiveWhy, '"1"').expect(412);
      const all = (await env.get(`rcas/${caseId}/analyses`).expect(200))
        .body as { fiveWhy: { rootCause: string } };
      expect(all.fiveWhy.rootCause).toBe('Wrong seal');
    });

    it('CA5: scores the FMEA on the server per cause; a missing rating stays null (a client RPN is refused)', async () => {
      const body = {
        failureMode: 'Seal leak',
        effects: [
          {
            id: 'e1',
            description: 'Leak',
            severity: 7,
            currentControls: '',
            detection: 3,
          },
        ],
        causes: [
          {
            id: 'c1',
            description: 'Wear',
            occurrence: 4,
            detection: 3,
            detectionControl: 'Weekly leak round',
          },
        ],
      };
      const saved = (
        await put(`rcas/${caseId}/analyses/fmea`, body).expect(200)
      ).body as ToolBody;
      expect(saved.causes?.[0].rpn).toBe(7 * 4 * 3);
      expect(saved).toMatchObject({ complete: true, rpnThreshold: 100 });
      await put(
        `rcas/${caseId}/analyses/fmea`,
        { ...body, causes: [{ ...body.causes[0], rpn: 1 }] },
        '"1"',
      ).expect(422);
      const draft = (
        await put(
          `rcas/${caseId}/analyses/fmea`,
          {
            ...body,
            causes: [{ id: 'c1', description: 'Wear', occurrence: 4 }],
          },
          '"1"',
        ).expect(200)
      ).body as ToolBody;
      expect(draft.complete).toBe(false);
      expect(draft.causes?.[0]).toMatchObject({
        rpn: null,
        actionPriority: null,
        missing: ['detection'],
      });
    });

    it('keeps tools to the case scope: other tenants 404, viewers and operators cannot write', async () => {
      await env.get(`rcas/${caseId}/analyses`, env.adminB).expect(404);
      await put(
        `rcas/${caseId}/analyses/change`,
        { question: 'What changed?', changes: [] },
        undefined,
        env.adminB,
      ).expect(404);
      await put(
        `rcas/${caseId}/analyses/change`,
        { question: 'What changed?', changes: [] },
        undefined,
        env.viewer,
      ).expect(403);
      await put(
        `rcas/${caseId}/analyses/change`,
        { question: 'What changed?', changes: [] },
        undefined,
        env.operator,
      ).expect(403);
      await put(`rcas/${randomUUID()}/analyses/change`, {
        question: 'What changed?',
        changes: [],
      }).expect(404);
    });
  });

  describe('case content and commands', () => {
    it('round-trips the evidence form, the team charter and the event diagram', async () => {
      const before = await read(caseId);
      const evidence = {
        id: 'ev-9',
        title: 'Bearing photo',
        type: 'Photo',
        severity: 'High',
        tags: ['bearing'],
        verified: true,
        fiveP: 'Parts',
        task: 'Collect the bearing',
        taskStatus: 'pending',
        nodeIds: ['n1'],
        timeSeries: {
          provider: 'pi',
          streams: 'P101.VIB',
          start: '2026-10-01T00:00:00.000Z',
          end: '2026-10-02T00:00:00.000Z',
        },
      };
      const eventDiagram = {
        nodes: [
          {
            id: 'e1',
            label: 'High vibration alarm',
            type: 'Alarm',
            timestamp: '2026-10-01T07:00:00.000Z',
            position: { x: 1, y: 2 },
          },
        ],
        edges: [],
      };
      await env
        .patch(
          `rcas/${caseId}`,
          { teamCharter: 'Stop the trips', evidence: [evidence], eventDiagram },
          `"${before.rowVersion}"`,
        )
        .expect(200);
      const after = await read(caseId);
      expect(after.teamCharter).toBe('Stop the trips');
      expect(after.evidence[0]).toMatchObject({
        ...evidence,
        timeSeries: expect.objectContaining({ streams: 'P101.VIB' }),
      });
      expect(after.eventDiagram.nodes[0]).toMatchObject({
        id: 'e1',
        label: 'High vibration alarm',
        position: { x: 1, y: 2 },
      });
    });

    it('opens a case with the template tree and resets the tree to it', async () => {
      const templateId = randomUUID();
      const tree = {
        nodes: [
          {
            name: 'Seal failure',
            category: 'Root',
            children: [{ name: 'Wrong seal', code: 'WS' }],
          },
        ],
      };
      await env.rows(
        `INSERT INTO rca_templates (id, template_name, template_data, organization_id, tenant_id) VALUES ($1, 'Seals', $2, $3, $4)`,
        [templateId, JSON.stringify(tree), randomUUID(), env.world.tenantA],
      );
      const created = (await env.createCase(
        env.example({ templateId, logicTree: [] }),
      )) as CaseView;
      expect(created.logicTree.map((n) => [n.id, n.parentId, n.label])).toEqual(
        [
          ['t1', null, 'Seal failure'],
          ['t2', 't1', 'Wrong seal'],
        ],
      );
      const edited = await env
        .patch(
          `rcas/${created.id}`,
          { logicTree: [] },
          `"${created.rowVersion}"`,
        )
        .expect(200);
      const reset = await env
        .http()
        .post(`/api/v2/rcas/${created.id}/logic-tree/reset`)
        .set(bearer(env.admin))
        .set('If-Match', `"${(edited.body as CaseBody).rowVersion}"`)
        .expect(201);
      expect((reset.body as CaseBody).logicTree).toHaveLength(2);
      const plain = await env.createCase(env.example({ templateId: null }));
      const refused = await env
        .http()
        .post(`/api/v2/rcas/${plain.id}/logic-tree/reset`)
        .set(bearer(env.admin))
        .set('If-Match', `"${plain.rowVersion}"`);
      expect(refused.status).toBe(422);
      expect((refused.body as ApiError).code).toBe('NO_TEMPLATE');
    });

    it('filters by priority and overdue and counts the scope in the summary', async () => {
      const overdue = await env.createCase(
        env.example({
          title: 'Overdue case',
          priority: 'Critical',
          status: 'Draft',
          targetCloseDate: new Date(Date.now() - 86_400_000).toISOString(),
        }),
      );
      const list = (
        await env.get('rcas?overdue=true&priority=Critical').expect(200)
      ).body as { items: Array<{ id: string }> };
      expect(list.items.map((item) => item.id)).toContain(overdue.id);
      const notOverdue = (await env.get('rcas?overdue=false').expect(200))
        .body as { items: Array<{ id: string }> };
      expect(notOverdue.items.map((item) => item.id)).not.toContain(overdue.id);
      await env.rows(
        `INSERT INTO rca_actions (tenant_id, rca_id, title, due_date, row_version)
         VALUES ($1, $2, 'Overdue action', now() - interval '2 days', 1)`,
        [env.world.tenantA, overdue.id],
      );
      await env.rows(
        `INSERT INTO rca_actions (tenant_id, rca_id, title, baseline, verification_window_start, verification_window_end, row_version)
         VALUES ($1, $2, 'Awaiting effectiveness', '{"value": 1}', now(), now() + interval '30 days', 1)`,
        [env.world.tenantA, overdue.id],
      );
      const summary = (await env.get('rcas/summary').expect(200)).body as {
        total: number;
        open: number;
        overdue: number;
        critical: number;
        overdueActions: number;
        effectivenessPending: number;
      };
      expect(summary.overdue).toBeGreaterThanOrEqual(1);
      expect(summary.critical).toBeGreaterThanOrEqual(1);
      expect(summary.open).toBeGreaterThanOrEqual(1);
      expect(summary.overdueActions).toBeGreaterThanOrEqual(1);
      expect(summary.effectivenessPending).toBeGreaterThanOrEqual(1);
      const tenantB = (await env.get('rcas/summary', env.adminB).expect(200))
        .body as { total: number; overdueActions: number };
      expect(tenantB).toMatchObject({ total: 0, overdueActions: 0 });
    });

    it('deletes an unreferenced case with If-Match and refuses a linked one', async () => {
      const spare = await env.createCase(env.example({ title: 'Spare case' }));
      await del(`rcas/${spare.id}`, '"99"').expect(412);
      await del(`rcas/${spare.id}`, `"${spare.rowVersion}"`, env.adminB).expect(
        404,
      );
      await del(`rcas/${spare.id}`, `"${spare.rowVersion}"`).expect(204);
      await env.get(`rcas/${spare.id}`).expect(404);
      const linked = await env.createCase(
        env.example({ title: 'Linked case' }),
      );
      const stop = await env.stopEvent(env.world.unitA1, 120, 60);
      await env
        .post(`rcas/${linked.id}/links`, { linkType: 'event', targetId: stop })
        .expect(201);
      const refused = await del(
        `rcas/${linked.id}`,
        `"${linked.rowVersion}"`,
      ).expect(409);
      expect((refused.body as ApiError).code).toBe('RCA_CASE_IN_USE');
    });
  });

  describe('evidence files', () => {
    it('stores a file, serves it only once an evidence item references it, and never to another tenant', async () => {
      const upload = await env
        .http()
        .post(`/api/v2/rcas/${caseId}/attachments`)
        .set(bearer(env.admin))
        .attach('file', Buffer.from('vibration,7.1'), 'trend.csv')
        .expect(201);
      const file = upload.body as { fileName: string; name: string };
      uploaded.push(file.fileName);
      expect(file.name).toBe('trend.csv');
      await env.get(`rcas/${caseId}/attachments/${file.fileName}`).expect(404);
      const current = await read(caseId);
      const evidence = [
        {
          id: 'ev-file',
          title: 'Trend export',
          attachments: [{ fileName: file.fileName, name: 'trend.csv' }],
        },
      ];
      await env
        .patch(`rcas/${caseId}`, { evidence }, `"${current.rowVersion}"`)
        .expect(200);
      const download = await env
        .get(`rcas/${caseId}/attachments/${file.fileName}`)
        .expect(200);
      expect(download.headers['cache-control']).toBe('private, no-store');
      await env
        .get(`rcas/${caseId}/attachments/${file.fileName}`, env.adminB)
        .expect(404);
      await env
        .http()
        .post(`/api/v2/rcas/${caseId}/attachments`)
        .set(bearer(env.adminB))
        .attach('file', Buffer.from('x'), 'x.csv')
        .expect(404);
    });
  });
});
