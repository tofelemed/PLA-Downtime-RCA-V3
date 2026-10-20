import { ApiError } from './support/plan-world';
import { catalogueCause } from './support/rca-causes';
import { RcaWorld } from './support/rca-world';

interface CauseBody {
  id: string;
  kind: string;
  causeCodeId: string | null;
  causeCode: { code: string; active: boolean } | null;
  evidenceIds: string[];
  nodeIds: string[];
  rowVersion: number;
}

interface Readiness {
  closure: {
    blockers: Array<{ code: string }>;
    rootCauseRule: { coded: boolean; codedRootCauses: number };
  };
}

interface CauseReport {
  items: Array<{
    causeCodeId: string;
    cases: number;
    causes: number;
    approvedLoss: { lines: number };
  }>;
}

/**
 * Typed causes (item 7) on real Postgres: CRUD with If-Match and the case scope, catalogue codes of the
 * plant only and never a retired one, the coded-root-cause closure rule for new cases (old cases keep the
 * free text), the lock once closure is requested, the recurring-cause report and its drill to the cases.
 */
describe('RCA typed causes', () => {
  const env = new RcaWorld();
  let caseId = '';
  let codeId = '';
  let cause: CauseBody;

  beforeAll(async () => {
    await env.start();
    caseId = (await env.createCase(env.example())).id;
    codeId = await catalogueCause(env, env.world.tenantA);
  });
  afterAll(() => env.stop());

  const addCause = (body: object, id = caseId, token = env.admin) =>
    env.post(
      `rcas/${id}/causes`,
      { kind: 'root', statement: 'Coupling misaligned', ...body },
      token,
    );
  const readiness = async (id = caseId) =>
    (await env.get(`rcas/${id}/readiness`).expect(200)).body as Readiness;
  const codeOf = (response: { body: unknown }) =>
    (response.body as ApiError).code;

  it('refuses retired, foreign and unknown references', async () => {
    const retired = await catalogueCause(env, env.world.tenantA, false);
    expect(codeOf(await addCause({ causeCodeId: retired }).expect(422))).toBe(
      'CAUSE_CODE_RETIRED',
    );
    const foreign = await catalogueCause(env, env.world.tenantB);
    expect(codeOf(await addCause({ causeCodeId: foreign }).expect(422))).toBe(
      'INVALID_REFERENCE',
    );
    expect(
      codeOf(await addCause({ evidenceIds: ['ev-404'] }).expect(422)),
    ).toBe('INVALID_REFERENCE');
  });

  it('a new case needs a coded root cause to request closure', async () => {
    const before = await readiness();
    expect(before.closure.rootCauseRule).toEqual({
      coded: true,
      codedRootCauses: 0,
    });
    expect(before.closure.blockers.map((b) => b.code)).toContain(
      'CODED_ROOT_CAUSE_MISSING',
    );
    cause = (
      await addCause({
        causeCodeId: codeId,
        evidenceIds: ['ev-1'],
        nodeIds: ['n2'],
      }).expect(201)
    ).body as CauseBody;
    expect(cause).toMatchObject({
      kind: 'root',
      causeCodeId: codeId,
      causeCode: { active: true },
      evidenceIds: ['ev-1'],
      nodeIds: ['n2'],
    });
    const after = await readiness();
    expect(after.closure.rootCauseRule.codedRootCauses).toBe(1);
    expect(after.closure.blockers.map((b) => b.code)).not.toContain(
      'CODED_ROOT_CAUSE_MISSING',
    );
  });

  it('a case opened before typed causes keeps the free-text rule', async () => {
    const old = await env.createCase(env.example({ rootCause: null }));
    await env.rows(
      `UPDATE rcas SET coded_root_cause_required = false WHERE id = $1`,
      [old.id],
    );
    const legacy = await readiness(old.id);
    expect(legacy.closure.rootCauseRule.coded).toBe(false);
    const codes = legacy.closure.blockers.map((b) => b.code);
    expect(codes).toContain('ROOT_CAUSE_MISSING');
    expect(codes).not.toContain('CODED_ROOT_CAUSE_MISSING');
  });

  it('changes need If-Match; a kept retired code stays, a newly assigned one is refused', async () => {
    const changed = await env
      .patch(
        `rca-case-causes/${cause.id}`,
        { statement: 'Coupling misaligned after the seal change' },
        `"${cause.rowVersion}"`,
      )
      .expect(200);
    await env
      .patch(
        `rca-case-causes/${cause.id}`,
        { kind: 'direct' },
        `"${cause.rowVersion}"`,
      )
      .expect(412);
    await env.rows(
      `UPDATE rca_cause_codes SET is_active = false WHERE id = $1`,
      [codeId],
    );
    const kept = await env
      .patch(
        `rca-case-causes/${cause.id}`,
        { kind: 'root', causeCodeId: codeId },
        `"${(changed.body as CauseBody).rowVersion}"`,
      )
      .expect(200);
    expect((kept.body as CauseBody).causeCode).toMatchObject({
      active: false,
    });
    expect(codeOf(await addCause({ causeCodeId: codeId }).expect(422))).toBe(
      'CAUSE_CODE_RETIRED',
    );
    await env.rows(
      `UPDATE rca_cause_codes SET is_active = true WHERE id = $1`,
      [codeId],
    );
    cause = kept.body as CauseBody;
  });

  it('is scoped to the caller units and audited', async () => {
    const other = await env.createCase(
      env.example({ unitId: env.world.unitA2, teamMemberIds: [] }),
    );
    await env.get(`rcas/${other.id}/causes`, env.reliability).expect(404);
    await addCause({}, other.id, env.reliability).expect(404);
    const history = (await env.get(`rcas/${caseId}/history`).expect(200))
      .body as { items: Array<{ action: string }> };
    expect(history.items.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['rca_cause.created', 'rca_cause.updated']),
    );
  });

  it('ranks catalogue causes by cases in the recurring-cause report', async () => {
    const second = await env.createCase(env.example());
    await addCause({ causeCodeId: codeId }, second.id).expect(201);
    const report = (await env.get('reports/rca-causes?kind=root').expect(200))
      .body as CauseReport;
    expect(report.items[0]).toMatchObject({
      causeCodeId: codeId,
      cases: 2,
      causes: 2,
    });
    expect(report.items[0].approvedLoss.lines).toBe(0);
  });

  it('lists the cases of a cause code in scope, retired codes included', async () => {
    const other = await env.createCase(
      env.example({ unitId: env.world.unitA2, teamMemberIds: [] }),
    );
    await addCause({ causeCodeId: codeId }, other.id).expect(201);
    const ids = async (query: string, token = env.admin) =>
      (
        (await env.get(`rcas?causeCodeId=${codeId}${query}`, token).expect(200))
          .body as { items: Array<{ id: string }> }
      ).items.map((item) => item.id);
    expect(await ids('')).toHaveLength(3);
    expect(await ids('')).toContain(other.id);
    expect(await ids('', env.reliability)).not.toContain(other.id);
    expect(await ids(`&unitId=${env.world.unitA2}`, env.reliability)).toEqual(
      [],
    );
    await env.rows(
      `UPDATE rca_cause_codes SET is_active = false WHERE id = $1`,
      [codeId],
    );
    expect(await ids(`&unitId=${env.world.unitA2}`)).toEqual([other.id]);
    await env.rows(
      `UPDATE rca_cause_codes SET is_active = true WHERE id = $1`,
      [codeId],
    );
    const unused = await catalogueCause(env, env.world.tenantA);
    const none = await env.get(`rcas?causeCodeId=${unused}`).expect(200);
    expect((none.body as { items: unknown[] }).items).toEqual([]);
  });

  it('causes are locked once closure is requested; delete needs If-Match', async () => {
    await env.rows(`UPDATE rcas SET status = 'Closure Review' WHERE id = $1`, [
      caseId,
    ]);
    expect(codeOf(await addCause({}).expect(422))).toBe('CAUSES_LOCKED');
    await env.rows(`UPDATE rcas SET status = 'Monitoring' WHERE id = $1`, [
      caseId,
    ]);
    await env
      .http()
      .delete(`/api/v2/rca-case-causes/${cause.id}`)
      .set('Authorization', `Bearer ${env.admin}`)
      .set('If-Match', `"${cause.rowVersion}"`)
      .expect(204);
    expect((await env.get(`rcas/${caseId}/causes`).expect(200)).body).toEqual(
      [],
    );
  });
});
