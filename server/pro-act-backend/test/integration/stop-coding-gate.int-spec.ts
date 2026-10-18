import { randomUUID } from 'crypto';
import { RECONCILIATION_TOLERANCE_DEFAULT } from '../../src/periods/engine-policy-bodies';
import { plus } from './support/accounting-world';
import { A, HOUR } from './support/actuals-world';
import { ApiError } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';
import { signToken } from './support/test-app';

interface GateBody {
  mode: string;
  stops: number;
  coded: number;
  investigationPending: number;
  uncoded: number;
  passes: boolean;
  issues: Array<{ code: string }>;
  verification: {
    verified: number;
    unverified: number;
    failureDetailed: number;
    validated: number;
  };
}

interface OutcomeBody {
  done: string[];
  skipped: Array<{ eventId: string; reason: string }>;
}

interface EventBody {
  rowVersion: number;
  investigationPending: boolean;
  verification: {
    verifiedBy: string | null;
    verifiedAt: string | null;
    validatedAt: string | null;
  };
}

/**
 * SME D12 submission gate and D13 staged verification on real Postgres: shift A1 has a coded stop (with
 * failure detail), an "investigation pending" stop and an uncoded stop. The period view shows the gate; a
 * `block` policy refuses the submission; a supervisor of the unit verifies the coded / pending stops of the
 * shift (never the uncoded one, never their own coding), maintenance validates the failure detail after it,
 * and a coding change clears the verification.
 */
describe('stop coding gate and verification (SME D12 / D13)', () => {
  const env = new ReconciliationWorld();
  const ids = { coded: '', pending: '', uncoded: '' };

  const person = async (role: string, unitId: string) => {
    const id = randomUUID();
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, $2, $3, 'x', 'Operator', $4)`,
      [id, role, `${id}@test.local`, env.world.tenantA],
    );
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'unit', $3, $4, 1)`,
      [env.world.tenantA, id, unitId, role],
    );
    return {
      id,
      token: signToken(env.app, {
        userId: id,
        tenantId: env.world.tenantA,
        role: 'Operator',
      }),
    };
  };
  const gate = async () =>
    (await env.view(env.periodA1)).codingGate as GateBody;
  const event = async (id: string) =>
    (await env.get(`production-events/${id}`).expect(200)).body as EventBody;
  const labelRevisions = (eventId: string, reason: string) =>
    env.rows<{ actorId: string; kind: string }>(
      `SELECT "actor_id"::text AS "actorId", "kind"::text AS "kind" FROM "event_revisions"
        WHERE "event_id" = $1 AND "change_reason" = $2`,
      [eventId, reason],
    );
  const labelMessages = async (eventId: string) =>
    (
      await env.rows<{ n: number }>(
        `SELECT count(*)::int AS "n" FROM "outbox" WHERE "aggregate_id" = $1
            AND "type" = 'EventChanged' AND "payload"->>'workflowOnly' = 'true'`,
        [eventId],
      )
    )[0].n;
  const recalcRequests = async () =>
    (
      await env.rows<{ n: number }>(
        `SELECT count(*)::int AS "n" FROM "outbox" WHERE "type" = 'PeriodRecalculateRequested'`,
      )
    )[0].n;

  beforeAll(async () => {
    await env.start();
    const reason = await env.reasonCode('FEED');
    ids.coded = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1, {
      reasonCodeId: reason,
      failureSeverity: 'critical',
    });
    ids.pending = await env.lossEvent(
      env.world.unitA1,
      plus(A, 3 * HOUR),
      0.5,
      {
        investigationPending: true,
      },
    );
    ids.uncoded = await env.lossEvent(
      env.world.unitA1,
      plus(A, 5 * HOUR),
      0.25,
    );
    await env.settle();
  });
  afterAll(() => env.stop());

  it('D12: the period view shows the gate — one stop without a reason or "investigation pending" (warn)', async () => {
    const result = await gate();
    expect(result).toMatchObject({
      mode: 'warn',
      stops: 3,
      coded: 1,
      investigationPending: 1,
      uncoded: 1,
      passes: false,
    });
    expect(result.issues.map((i) => i.code)).toContain('STOPS_UNCODED');
    expect(result.verification).toMatchObject({
      verified: 0,
      unverified: 3,
      failureDetailed: 1,
    });
    expect((await event(ids.pending)).investigationPending).toBe(true);
  });

  it('D12: a `block` gate refuses the submission with 422 CODING_INCOMPLETE', async () => {
    await env.tolerancePolicy(env.world.unitA1, {
      ...RECONCILIATION_TOLERANCE_DEFAULT,
      submitGate: { mode: 'block', codedRatioTarget: 0.95 },
    });
    await env.recompute(env.periodA1);
    await env.settle();
    const view = await env.view(env.periodA1);
    expect((view.codingGate as GateBody).mode).toBe('block');
    const refused = await env.submit(view).expect(422);
    expect((refused.body as ApiError).code).toBe('CODING_INCOMPLETE');
  });

  it('D13: a supervisor of the unit verifies the shift — the uncoded stop is skipped', async () => {
    const supervisor = await person('production_engineer', env.world.unitA1);
    const versionBefore = (await event(ids.coded)).rowVersion;
    const recalcBefore = await recalcRequests();
    const outcome = (
      await env
        .post(
          'production-events/verification',
          { periodId: env.periodA1 },
          supervisor.token,
        )
        .expect(200)
    ).body as OutcomeBody;
    expect(outcome.done.sort()).toEqual([ids.coded, ids.pending].sort());
    expect(outcome.skipped).toEqual([
      { eventId: ids.uncoded, reason: 'NOT_CODED' },
    ]);
    const verified = await event(ids.coded);
    expect(verified.verification.verifiedBy).toBe(supervisor.id);
    expect(verified.rowVersion).toBe(versionBefore + 1);
    // each label is one event revision by the verifier with its EventChanged in the outbox
    for (const id of [ids.coded, ids.pending]) {
      expect(await labelRevisions(id, 'verification')).toEqual([
        { actorId: supervisor.id, kind: 'user' },
      ]);
      expect(await labelMessages(id)).toBe(1);
    }
    expect(await labelRevisions(ids.uncoded, 'verification')).toEqual([]);
    // a label changes no quantity: its messages request no period recalculation
    await env.settle();
    expect(await recalcRequests()).toBe(recalcBefore);
    expect((await gate()).verification).toMatchObject({
      verified: 2,
      unverified: 1,
    });
    // a second call verifies nothing twice
    const again = (
      await env
        .post(
          'production-events/verification',
          { eventIds: [ids.coded] },
          supervisor.token,
        )
        .expect(200)
    ).body as OutcomeBody;
    expect(again.skipped).toEqual([
      { eventId: ids.coded, reason: 'ALREADY_VERIFIED' },
    ]);
  });

  it('D13: other units, other roles and both selections at once are refused', async () => {
    const elsewhere = await person('production_engineer', env.world.unitA2);
    const outcome = (
      await env
        .post(
          'production-events/verification',
          { eventIds: [ids.uncoded] },
          elsewhere.token,
        )
        .expect(200)
    ).body as OutcomeBody;
    expect(outcome.skipped).toEqual([
      { eventId: ids.uncoded, reason: 'NOT_FOUND' },
    ]);
    const operator = await person('operator', env.world.unitA1);
    await env
      .post(
        'production-events/verification',
        { eventIds: [ids.uncoded] },
        operator.token,
      )
      .expect(403);
    const both = await env
      .post('production-events/verification', {
        eventIds: [ids.uncoded],
        periodId: env.periodA1,
      })
      .expect(422);
    expect((both.body as ApiError).code).toBe('SELECTION_REQUIRED');
  });

  it('D13: maintenance validates the failure detail of a verified stop only', async () => {
    const maintenance = await person('reliability_engineer', env.world.unitA1);
    const versionBefore = (await event(ids.coded)).rowVersion;
    const pending = (
      await env
        .post(
          `production-events/${ids.pending}/validate-failure`,
          {},
          maintenance.token,
        )
        .expect(200)
    ).body as OutcomeBody;
    expect(pending.skipped).toEqual([
      { eventId: ids.pending, reason: 'NO_FAILURE_DETAIL' },
    ]);
    const coded = (
      await env
        .post(
          `production-events/${ids.coded}/validate-failure`,
          {},
          maintenance.token,
        )
        .expect(200)
    ).body as OutcomeBody;
    expect(coded.done).toEqual([ids.coded]);
    const validated = await event(ids.coded);
    expect(validated.verification.validatedAt).not.toBeNull();
    expect(validated.rowVersion).toBe(versionBefore + 1);
    expect(await labelRevisions(ids.coded, 'failure_validation')).toEqual([
      { actorId: maintenance.id, kind: 'user' },
    ]);
    expect(await labelRevisions(ids.pending, 'failure_validation')).toEqual([]);
    expect(await labelMessages(ids.coded)).toBe(2);
  });

  it('D13: changing the coding clears the verification (recording is never blocked)', async () => {
    const before = await event(ids.coded);
    await env
      .patch(
        `production-events/${ids.coded}`,
        { reasonCodeId: await env.reasonCode('POWER') },
        `"${before.rowVersion}"`,
      )
      .expect(200);
    const after = await event(ids.coded);
    expect(after.verification.verifiedAt).toBeNull();
    expect(after.verification.validatedAt).not.toBeNull();
  });
});
