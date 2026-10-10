import { A, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';
import { CaseBody, LinkResultBody, RcaWorld } from './support/rca-world';

/**
 * Plan 3.9 on real Postgres: the v2 case contract (the frontend body round-trips with its nested content —
 * regression of the verified v1 save bug), authorization and scope (§13.2: operator and viewer refused,
 * a unit-limited reliability engineer writes in its unit only, foreign ids 404 / 422), RCA02 links with
 * evidence packages and approved impact (idempotent repeat), RCA03 actions with verification and the
 * three separate figures, closing into the knowledge base, and the resolved circular FK.
 */
describe('RCA cases, links and actions (plan 3.9)', () => {
  const env = new RcaWorld();
  let reason = '';
  let first = '';
  let second = '';
  let caseId = '';

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('BRG');
    const asset = { assetId: env.world.assetA1, reasonCodeId: reason };
    first = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1, asset);
    second = await env.lossEvent(
      env.world.unitA1,
      plus(A, 3 * HOUR),
      0.5,
      asset,
    );
    await env.approvePeriodA1(reason);
  });
  afterAll(() => env.stop());

  describe('contract (step 1)', () => {
    it('creates a case from the frontend body and returns every nested item', async () => {
      const created = await env.createCase(env.example());
      const read = (await env.get(`rcas/${created.id}`).expect(200))
        .body as CaseBody;
      expect(read).toMatchObject({
        title: 'Repeated trips of feed pump P-101',
        status: 'In Progress',
        unitId: env.world.unitA1,
      });
      expect(read.teamMemberIds).toEqual(env.members);
      expect(read.recommendations[0]).toMatchObject({
        title: 'Replace the coupling',
        ownerId: env.members[1],
      });
      expect(read.evidence[0]).toMatchObject({
        title: 'Vibration trend',
        source: 'PI tag P101.VIB',
      });
      expect(read.logicTree.map((n) => n.id)).toEqual(['n1', 'n2']);
      caseId = created.id;
    });

    it('PATCH needs If-Match, replaces nested content and answers 412 on a stale version', async () => {
      const before = (await env.get(`rcas/${caseId}`).expect(200))
        .body as CaseBody;
      const changed = await env
        .patch(
          `rcas/${caseId}`,
          { rootCause: 'Misalignment', evidence: [] },
          `"${before.rowVersion}"`,
        )
        .expect(200);
      expect((changed.body as CaseBody).evidence).toEqual([]);
      const stale = await env
        .patch(`rcas/${caseId}`, { title: 'x' }, `"${before.rowVersion}"`)
        .expect(412);
      expect((stale.body as ApiError).code).toBe('STALE_REVISION');
    });

    it('v1 POST /rcas accepts the array bodies of the v1 screen and the e2e suite', async () => {
      const response = await env
        .v1()
        .post('rcas', {
          title: 'v1 case',
          status: 'Draft',
          priority: 'High',
          recommendations: [],
          evidence: [],
          teamMemberIds: [],
        })
        .expect(201);
      expect(
        (response.body as { recommendations: string }).recommendations,
      ).toBe('[]');
    });
  });

  describe('authorization and scope', () => {
    it('operator and viewer cannot open cases; the tenant query parameter is refused', async () => {
      await env
        .post('rcas', { title: 'x', unitId: env.world.unitA1 }, env.operator)
        .expect(403);
      await env
        .post('rcas', { title: 'x', unitId: env.world.unitA1 }, env.viewer)
        .expect(403);
      await env.get(`rcas?tenantId=${env.world.tenantA}`).expect(400);
    });

    it('a unit-limited reliability engineer writes in its unit only', async () => {
      await env.createCase(
        { title: 'own unit', unitId: env.world.unitA1 },
        env.reliability,
      );
      const foreign = await env
        .post('rcas', { title: 'x', unitId: env.world.unitA2 }, env.reliability)
        .expect(422);
      expect((foreign.body as ApiError).code).toBe('INVALID_REFERENCE');
      const wide = await env
        .post('rcas', { title: 'x' }, env.reliability)
        .expect(403);
      expect((wide.body as ApiError).code).toBe('TENANT_SCOPE_REQUIRED');
      const otherUnit = await env.createCase({
        title: 'A2 case',
        unitId: env.world.unitA2,
      });
      await env.get(`rcas/${otherUnit.id}`, env.reliability).expect(404);
      const list = (
        await env.get('rcas?limit=500', env.reliability).expect(200)
      ).body as { items: CaseBody[] };
      expect(list.items.every((item) => item.unitId === env.world.unitA1)).toBe(
        true,
      );
    });

    it('another tenant sees nothing; foreign body ids are 422', async () => {
      await env.get(`rcas/${caseId}`, env.adminB).expect(404);
      await env.linkEvent(first, { rcaId: caseId }, env.adminB).expect(404);
      const ghost = await env
        .post(`rcas/${caseId}/links`, {
          linkType: 'event',
          targetId: env.world.events.eB1,
        })
        .expect(422);
      expect((ghost.body as ApiError).code).toBe('INVALID_REFERENCE');
    });
  });

  describe('RCA02 links and evidence package', () => {
    it('links two events and an approved loss line once each, with evidence', async () => {
      const linked = (
        await env
          .linkEvent(first, { rcaId: caseId, reason: 'same symptom' })
          .expect(201)
      ).body as LinkResultBody;
      expect(linked).toMatchObject({ created: true, caseCreated: false });
      const evidence = linked.link.evidence as {
        revisions: unknown[];
        causeCodes: { reasonCode: { id: string } };
        approvedImpact: { lines: number; quantities: unknown[] };
        trendWindow: { from: string };
      };
      expect(evidence.revisions.length).toBeGreaterThan(0);
      expect(evidence.causeCodes.reasonCode.id).toBe(reason);
      expect(evidence.approvedImpact.lines).toBeGreaterThan(0);
      const secondLink = (
        await env.linkEvent(second, { rcaId: caseId }).expect(201)
      ).body as LinkResultBody;
      expect(
        (secondLink.link.evidence as { recurrence: { sameAsset: number } })
          .recurrence.sameAsset,
      ).toBeGreaterThanOrEqual(1);
      const [line] = await env.rows<{ id: string }>(
        `SELECT id FROM loss_lines WHERE cause_event_id = $1 AND state = 'active' LIMIT 1`,
        [first],
      );
      await env
        .post(`rcas/${caseId}/links`, {
          linkType: 'loss_line',
          targetId: line.id,
        })
        .expect(201);
      const again = (await env.linkEvent(first, { rcaId: caseId }).expect(200))
        .body as LinkResultBody;
      expect(again.created).toBe(false);
      const links = (await env.get(`rcas/${caseId}/links`).expect(200))
        .body as Array<{ linkType: string }>;
      expect(links.map((l) => l.linkType).sort()).toEqual([
        'event',
        'event',
        'loss_line',
      ]);
      const [event] = await env.rows<{ rca_state: string; rca_id: string }>(
        `SELECT rca_state, rca_id FROM production_events WHERE id = $1`,
        [first],
      );
      expect(event).toEqual({ rca_state: 'linked', rca_id: caseId });
    });

    it('creates a case with the event (unit from the event) and needs exactly one of rcaId / create', async () => {
      const created = (
        await env
          .linkEvent(second, { create: { title: 'Second look' } })
          .expect(201)
      ).body as LinkResultBody;
      expect(created.caseCreated).toBe(true);
      const read = (await env.get(`rcas/${created.rca.id}`).expect(200))
        .body as CaseBody;
      expect(read.unitId).toBe(env.world.unitA1);
      await env.linkEvent(second, {}).expect(422);
      await env.linkEvent(second, { rcaId: caseId }, env.operator).expect(403);
    });
  });

  describe('RCA03 actions, outcome and close', () => {
    it('verifies an action after its window and keeps claimed / approved / realized apart', async () => {
      const action = await env
        .post(`rcas/${caseId}/actions`, {
          title: 'Realign coupling',
          ownerId: env.members[1],
          verificationWindowStart: plus(
            new Date().toISOString(),
            -20 * 24 * HOUR,
          ),
          verificationWindowEnd: plus(new Date().toISOString(), -5 * 24 * HOUR),
          baseline: { metric: 'recurrences', windowDays: 30, value: '6' },
          claimedAvoidedLoss: '1000',
          claimedCurrency: 'USD',
        })
        .expect(201);
      const body = action.body as {
        id: string;
        rowVersion: number;
        verificationStatus: string;
      };
      expect(body.verificationStatus).toBe('due');
      const verified = await env
        .http()
        .post(`/api/v2/rca-actions/${body.id}/verify`)
        .set('Authorization', `Bearer ${env.admin}`)
        .set('Idempotency-Key', `verify-${body.id}`)
        .set('If-Match', `"${body.rowVersion}"`)
        .expect(200);
      expect(
        (verified.body as { postAction: { realized: unknown } }).postAction
          .realized,
      ).toEqual({
        metric: 'recurrences',
        expected: '3',
        observed: '0',
        difference: '3',
      });
      const outcome = (await env.get(`rcas/${caseId}/outcome`).expect(200))
        .body as {
        approvedHistoricalLoss: { lines: number };
        claimedAvoided: unknown[];
        realized: unknown[];
      };
      expect(outcome.approvedHistoricalLoss.lines).toBeGreaterThan(0);
      expect(outcome.claimedAvoided).toEqual([
        { currency: 'USD', amount: '1000', actions: 1 },
      ]);
      expect(outcome.realized).toHaveLength(1);
    });

    it('refuses a counted baseline without window and verification before the window ends', async () => {
      const counted = await env
        .post(`rcas/${caseId}/actions`, {
          title: 'x',
          baseline: { metric: 'recurrences', windowDays: 30 },
        })
        .expect(422);
      expect((counted.body as ApiError).code).toBe('BASELINE_NEEDS_WINDOW');
      const future = (
        await env
          .post(`rcas/${caseId}/actions`, {
            title: 'later',
            verificationWindowStart: plus(new Date().toISOString(), 24 * HOUR),
            verificationWindowEnd: plus(new Date().toISOString(), 48 * HOUR),
            baseline: { metric: 'downtime_seconds', windowDays: 30 },
          })
          .expect(201)
      ).body as {
        id: string;
        rowVersion: number;
        baseline: { declared: boolean };
      };
      expect(future.baseline.declared).toBe(false);
      const open = await env
        .http()
        .post(`/api/v2/rca-actions/${future.id}/verify`)
        .set('Authorization', `Bearer ${env.admin}`)
        .set('Idempotency-Key', `verify-${future.id}`)
        .set('If-Match', `"${future.rowVersion}"`)
        .expect(409);
      expect((open.body as ApiError).code).toBe('VERIFICATION_WINDOW_OPEN');
    });

    it('closing feeds the knowledge base and completes the linked events', async () => {
      const current = (await env.get(`rcas/${caseId}`).expect(200))
        .body as CaseBody;
      await env
        .patch(
          `rcas/${caseId}`,
          { status: 'Closed' },
          `"${current.rowVersion}"`,
        )
        .expect(200);
      const entries = await env.rows<{
        is_published: boolean;
        root_cause: string;
      }>(
        `SELECT is_published, root_cause FROM rca_knowledge_base WHERE rca_id = $1`,
        [caseId],
      );
      expect(entries).toEqual([
        { is_published: false, root_cause: 'Misalignment' },
      ]);
      const states = await env.rows<{ rca_state: string }>(
        `SELECT rca_state FROM production_events WHERE id = ANY($1::uuid[])`,
        [[first, second]],
      );
      expect(states.map((s) => s.rca_state)).toEqual([
        'completed',
        'completed',
      ]);
    });
  });

  it('a linked case can be deleted (the circular FK clears the event pointer)', async () => {
    const extra = await env.createCase({
      title: 'to delete',
      unitId: env.world.unitA1,
    });
    const stopId = await env.stopEvent(env.world.unitA1, 120, 100);
    await env.linkEvent(stopId, { rcaId: extra.id }).expect(201);
    await env.v1().del(`rcas/${extra.id}`).expect(200);
    const [event] = await env.rows<{ rca_id: string | null }>(
      `SELECT rca_id FROM production_events WHERE id = $1`,
      [stopId],
    );
    expect(event.rca_id).toBeNull();
    const links = await env.rows(
      `SELECT 1 FROM rca_case_links WHERE rca_id = $1`,
      [extra.id],
    );
    expect(links).toHaveLength(0);
  });
});
