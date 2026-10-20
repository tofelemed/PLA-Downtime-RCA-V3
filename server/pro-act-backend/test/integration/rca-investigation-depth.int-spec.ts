import { RCA_POLICY_DEFAULT } from '../../src/domain/rca/rca-policy';
import { ApiError } from './support/plan-world';
import { addCodedRootCause } from './support/rca-causes';
import { CaseBody, RcaWorld } from './support/rca-world';

interface Issue {
  code: string;
  field: string;
  message: string;
  methods?: string[];
}

interface ReadinessBody {
  status: string;
  investigation: { blockers: Issue[]; advice: Issue[] };
  closure: { blockers: Issue[] };
  rules: {
    consequenceClass: string | null;
    investigationDepth: {
      version: string;
      methodGroups: string[][];
      teamCharter: boolean;
      codedCauses: boolean;
      independentClosure: boolean;
    } | null;
  };
}

const LOGIC_TREE = [
  {
    id: 'n1',
    parentId: null,
    label: 'Compressor trip',
    kind: 'event',
    status: 'open',
    notes: null,
  },
  {
    id: 'n2',
    parentId: 'n1',
    label: 'Seal leak',
    kind: 'hypothesis',
    status: 'verified',
    notes: null,
  },
];

/**
 * Tier 2 item 2.7 / D-T4 on real Postgres: the readiness of a major case lists what its class needs, by
 * code (METHOD_REQUIRED with the methods, TEAM_CHARTER_REQUIRED, CODED_CAUSE_REQUIRED), the acceptance is
 * refused with the same codes until they are met, an unclassified case is only asked for its class, and a
 * case already in Monitoring is never blocked by the matrix. The unit's `rca_policy` has empty CA7 tiers,
 * so only the D-T4 matrix is under test.
 */
describe('RCA investigation depth by consequence class (D-T4)', () => {
  const env = new RcaWorld();

  const readiness = async (id: string) =>
    (await env.get(`rcas/${id}/readiness`).expect(200)).body as ReadinessBody;
  const read = async (id: string) =>
    (await env.get(`rcas/${id}`).expect(200)).body as CaseBody;
  const transition = async (id: string, to: string) =>
    env
      .http()
      .post(`/api/v2/rcas/${id}/transitions`)
      .set('Authorization', `Bearer ${env.admin}`)
      .set('If-Match', `"${(await read(id)).rowVersion}"`)
      .send({ to });
  const patch = async (id: string, body: object) =>
    env
      .patch(`rcas/${id}`, body, `"${(await read(id)).rowVersion}"`)
      .expect(200);
  const codes = (issues: Issue[]) => issues.map((issue) => issue.code);

  beforeAll(async () => {
    await env.start();
    const empty = { methodGroups: [], minTeamMembers: 0 };
    await env.unitRcaPolicy(env.world.unitA1, {
      ...RCA_POLICY_DEFAULT,
      investigation: {
        minor: empty,
        significant: empty,
        major: empty,
        critical: empty,
      },
    });
  });
  afterAll(() => env.stop());

  it('a major case lists its missing requirements by code and is refused until they are met', async () => {
    const { id } = await env.createCase({
      title: 'Recycle compressor seal failures',
      unitId: env.world.unitA1,
      status: 'In Progress',
      consequenceClass: 'major',
      rootCause: 'Seal flush plan not suited to the gas composition',
    });
    expect((await transition(id, 'Analysis')).status).toBe(200);
    await env
      .post(`rcas/${id}/actions`, { title: 'Change the seal flush plan' })
      .expect(201);

    const before = await readiness(id);
    expect(before.rules.investigationDepth).toMatchObject({
      version: 'd-t4-v1',
      methodGroups: [['logic_tree', 'fault_tree']],
      teamCharter: true,
      codedCauses: true,
      independentClosure: true,
    });
    expect(codes(before.investigation.blockers)).toEqual([
      'METHOD_REQUIRED',
      'TEAM_CHARTER_REQUIRED',
      'CODED_CAUSE_REQUIRED',
    ]);
    expect(before.investigation.blockers[0].methods).toEqual([
      'logic_tree',
      'fault_tree',
    ]);

    const refused = await transition(id, 'Monitoring');
    expect(refused.status).toBe(422);
    expect((refused.body as ApiError).code).toBe('INVESTIGATION_BLOCKED');
    expect(
      (refused.body as { details: { blockers: string[] } }).details.blockers,
    ).toEqual([
      'METHOD_REQUIRED',
      'TEAM_CHARTER_REQUIRED',
      'CODED_CAUSE_REQUIRED',
    ]);

    await patch(id, {
      logicTree: LOGIC_TREE,
      teamCharter:
        'Stop the seal failures of K-301; lead, rotating equipment engineer, operator',
    });
    await addCodedRootCause(env, env.world.tenantA, id);
    expect((await readiness(id)).investigation.blockers).toEqual([]);
    expect((await transition(id, 'Monitoring')).status).toBe(200);
  });

  it('an unclassified case is asked for its class only (no depth requirement yet)', async () => {
    const { id } = await env.createCase({
      title: 'Unclassified trip',
      unitId: env.world.unitA1,
      status: 'In Progress',
      rootCause: 'Unknown yet',
    });
    const body = await readiness(id);
    expect(body.rules.investigationDepth).toBeNull();
    expect(codes(body.investigation.blockers)).toContain(
      'CONSEQUENCE_CLASS_MISSING',
    );
    expect(codes(body.investigation.blockers)).not.toContain('METHOD_REQUIRED');
  });

  it('a critical case needs a logic tree plus an FMEA or fault tree', async () => {
    const { id } = await env.createCase({
      title: 'Flare knock-out drum overfill',
      unitId: env.world.unitA1,
      status: 'In Progress',
      consequenceClass: 'critical',
      logicTree: LOGIC_TREE,
    });
    const blockers = (await readiness(id)).investigation.blockers;
    const methods = blockers.filter(
      (issue) => issue.code === 'METHOD_REQUIRED',
    );
    expect(methods.map((issue) => issue.methods)).toEqual([
      ['fmea', 'fault_tree'],
    ]);
  });

  it('a case already in Monitoring is never blocked by the matrix', async () => {
    const { id } = await env.createCase({
      title: 'Older major case',
      unitId: env.world.unitA1,
      status: 'In Progress',
      consequenceClass: 'major',
    });
    await env.rows(`UPDATE rcas SET status = 'Monitoring' WHERE id = $1`, [id]);
    const body = await readiness(id);
    expect(body.status).toBe('Monitoring');
    const closure = codes(body.closure.blockers);
    for (const code of [
      'METHOD_REQUIRED',
      'TEAM_CHARTER_REQUIRED',
      'CODED_CAUSE_REQUIRED',
    ]) {
      expect(closure).not.toContain(code);
    }
  });
});
