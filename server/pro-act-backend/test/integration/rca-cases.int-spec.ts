import { A, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';
import { addCodedRootCause } from './support/rca-causes';
import {
  closedCaseWrites,
  expectRepairHistory,
  expectSweepSkips,
} from './support/rca-closed-case';
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

  describe('RCA03 actions, outcome and the CA1 workflow', () => {
    const transition = (body: object, token = env.admin) =>
      env.get(`rcas/${caseId}`).then((read) =>
        env
          .http()
          .post(`/api/v2/rcas/${caseId}/transitions`)
          .set('Authorization', `Bearer ${token}`)
          .set('If-Match', `"${(read.body as CaseBody).rowVersion}"`)
          .send(body),
      );
    const codeOf = (response: { body: unknown }) =>
      (response.body as ApiError).code;
    let actionId = '';

    it('CA3: a typed baseline is refused; the server computes and freezes it from history', async () => {
      const declared = await env
        .post(`rcas/${caseId}/actions`, {
          title: 'x',
          baseline: { metric: 'recurrences', windowDays: 30, value: '6' },
        })
        .expect(422);
      expect(codeOf(declared)).toBe('BASELINE_DECLARED');
      const counted = await env
        .post(`rcas/${caseId}/actions`, {
          title: 'x',
          baseline: { metric: 'recurrences' },
        })
        .expect(422);
      expect(codeOf(counted)).toBe('BASELINE_NEEDS_WINDOW');
      const action = await env
        .post(`rcas/${caseId}/actions`, {
          title: 'Realign coupling',
          ownerId: env.members[1],
          verificationWindowStart: plus(
            new Date().toISOString(),
            -20 * 24 * HOUR,
          ),
          verificationWindowEnd: plus(new Date().toISOString(), -5 * 24 * HOUR),
          baseline: { metric: 'recurrences', windowDays: 30 },
          claimedAvoidedLoss: '1000',
          claimedCurrency: 'USD',
        })
        .expect(201);
      const body = action.body as {
        id: string;
        verificationStatus: string;
        baseline: {
          declared: boolean;
          queryVersion: string;
          criteria: object;
          window: object;
        };
      };
      expect(body.verificationStatus).toBe('due');
      expect(body.baseline).toMatchObject({
        declared: false,
        queryVersion: 'rca-exposure-v3',
        criteria: { requiredReduction: 0.5, minExposureHours: 720 },
      });
      actionId = body.id;
    });

    it('CA2: verification after the window gives a verdict; 15 days of run time is insufficient evidence', async () => {
      const [row] = await env.rows<{ row_version: number }>(
        `SELECT row_version FROM rca_actions WHERE id = $1`,
        [actionId],
      );
      const verified = await env
        .http()
        .post(`/api/v2/rca-actions/${actionId}/verify`)
        .set('Authorization', `Bearer ${env.admin}`)
        .set('Idempotency-Key', `verify-${actionId}`)
        .set('If-Match', `"${row.row_version}"`)
        .expect(200);
      const view = verified.body as {
        verdict: string;
        postAction: { realized: object; effectiveness: { reasons: string[] } };
      };
      expect(view.postAction.realized).toEqual({
        metric: 'recurrences',
        expected: '0',
        observed: '0',
        difference: '0',
      });
      expect(view.verdict).toBe('insufficient_evidence');
      const outcome = (await env.get(`rcas/${caseId}/outcome`).expect(200))
        .body as {
        approvedHistoricalLoss: { lines: number; view: string; basis: string };
        claimedAvoided: unknown[];
        realized: Array<{ verdict: string }>;
      };
      expect(outcome.approvedHistoricalLoss.lines).toBeGreaterThan(0);
      const [frozen] = await env.rows<{ view: string }>(
        `SELECT evidence -> 'approvedImpact' ->> 'view' AS view FROM rca_case_links
          WHERE rca_id = $1 AND evidence -> 'approvedImpact' ->> 'view' IS NOT NULL ORDER BY linked_at LIMIT 1`,
        [caseId],
      );
      // QA M3: one basis on Links & outcome — the view frozen in the linked evidence package, named
      expect(outcome.approvedHistoricalLoss.view).toBe(frozen.view);
      expect(outcome.approvedHistoricalLoss.basis).toMatch(
        /^Approved plan lines .*linked evidence package/,
      );
      expect(outcome.approvedHistoricalLoss.basis).not.toMatch(
        /SME|policy default/,
      );
      expect(outcome.claimedAvoided).toEqual([
        { currency: 'USD', amount: '1000', actions: 1 },
      ]);
      expect(outcome.realized[0].verdict).toBe('insufficient_evidence');
    });

    it('RCA-01: the status never comes from an edit and never jumps to Closed', async () => {
      const before = (await env.get(`rcas/${caseId}`).expect(200))
        .body as CaseBody;
      const edit = await env
        .patch(`rcas/${caseId}`, { status: 'Closed' }, `"${before.rowVersion}"`)
        .expect(422);
      expect(codeOf(edit)).toBe('STATUS_VIA_TRANSITION');
      expect(codeOf(await transition({ to: 'Closed' }))).toBe(
        'INVALID_TRANSITION',
      );
      await transition({ to: 'Analysis' }).then((r) =>
        expect(r.status).toBe(200),
      );
    });

    it('CA1 / CA7: accepting the investigation needs the consequence class and its methods', async () => {
      const blocked = await transition({ to: 'Monitoring' });
      expect(blocked.status).toBe(422);
      expect(codeOf(blocked)).toBe('INVESTIGATION_BLOCKED');
      expect(
        (blocked.body as { details: { blockers: string[] } }).details.blockers,
      ).toContain('CONSEQUENCE_CLASS_MISSING');
      const read = (await env.get(`rcas/${caseId}`).expect(200))
        .body as CaseBody;
      await env
        .patch(
          `rcas/${caseId}`,
          { consequenceClass: 'minor' },
          `"${read.rowVersion}"`,
        )
        .expect(200);
      const readiness = (await env.get(`rcas/${caseId}/readiness`).expect(200))
        .body as {
        investigation: { blockers: unknown[] };
        rules: { fiveWhyUnsupportedRootCauses: string[] };
      };
      expect(readiness.investigation.blockers).toEqual([]);
      // the 5-Why checklist reads the phrases the gate refuses from here (Marun RCA test)
      expect(readiness.rules.fiveWhyUnsupportedRootCauses).toContain(
        'operator error',
      );
      await transition({ to: 'Monitoring' }).then((r) =>
        expect(r.status).toBe(200),
      );
    });

    it('CA4: done needs the action type, objective evidence and a verifier', async () => {
      const done = async (body: object) => {
        const [row] = await env.rows<{ row_version: number }>(
          `SELECT row_version FROM rca_actions WHERE id = $1`,
          [actionId],
        );
        return env.patch(
          `rca-actions/${actionId}`,
          { status: 'done', ...body },
          `"${row.row_version}"`,
        );
      };
      expect(codeOf(await done({}))).toBe('ACTION_TYPE_REQUIRED');
      expect(codeOf(await done({ actionType: 'repair' }))).toBe(
        'EVIDENCE_REQUIRED',
      );
      const ok = await done({
        actionType: 'repair',
        completionEvidenceRef: 'WO-4711 op 20, acceptance test AT-12',
      });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({
        status: 'done',
        hasEvidence: true,
        evidenceExpected: 'work-order operation and acceptance test',
      });
      expect(
        (ok.body as { completionVerifiedBy: string | null })
          .completionVerifiedBy,
      ).not.toBeNull();
    });

    it('CA1: closure needs every action finished and the residual risk disposed of', async () => {
      await env
        .post(`rcas/${caseId}/actions`, { title: 'Check the base plate' })
        .expect(201);
      const open = await transition({ to: 'Closure Review' });
      expect(codeOf(open)).toBe('CLOSE_BLOCKED');
      expect(
        (open.body as { details: { blockers: string[] } }).details.blockers,
      ).toEqual(
        expect.arrayContaining(['ACTIONS_NOT_DONE', 'RESIDUAL_RISK_MISSING']),
      );
      const others = await env.rows<{ id: string; row_version: number }>(
        `SELECT id, row_version FROM rca_actions WHERE rca_id = $1 AND status NOT IN ('done', 'cancelled')`,
        [caseId],
      );
      for (const action of others) {
        await env
          .patch(
            `rca-actions/${action.id}`,
            { status: 'cancelled' },
            `"${action.row_version}"`,
          )
          .expect(200);
      }
      await addCodedRootCause(env, env.world.tenantA, caseId);
      const requested = await transition({
        to: 'Closure Review',
        residualRisk:
          'Alignment checked at each PM; no residual risk beyond the monitored task',
      });
      expect(requested.body).toMatchObject({ status: 'Closure Review' });
      expect(requested.body).toMatchObject({
        status: 'Closure Review',
        effectivenessVerdict: 'insufficient_evidence',
      });
    });

    it('CA1: the investigator never approves the closure; an independent manager approver does', async () => {
      const self = await transition({ to: 'Closed' });
      expect(self.status).toBe(403);
      expect(codeOf(self)).toBe('SEPARATION_OF_DUTIES');
      const engineer = await transition({ to: 'Closed' }, env.reliability);
      expect(codeOf(engineer)).toBe('FORBIDDEN_ROLE');
      const readiness = (
        await env.get(`rcas/${caseId}/readiness`, env.approver).expect(200)
      ).body as {
        approver: { canApprove: boolean };
      };
      expect(readiness.approver.canApprove).toBe(true);
      const closed = await transition({ to: 'Closed' }, env.approver);
      expect(closed.status).toBe(200);
      expect(closed.body).toMatchObject({ status: 'Closed' });
      expect(
        (closed.body as { closureApprovedBy: string | null }).closureApprovedBy,
      ).not.toBeNull();
    });

    it('closing feeds the knowledge base (lesson unverified) and completes the linked events', async () => {
      const entries = await env.rows<{
        is_published: boolean;
        root_cause: string;
        lesson_status: string;
      }>(
        `SELECT is_published, root_cause, lesson_status FROM rca_knowledge_base WHERE rca_id = $1`,
        [caseId],
      );
      expect(entries).toEqual([
        {
          is_published: false,
          root_cause: 'Misalignment',
          lesson_status: 'unverified',
        },
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

    it('G4: a closed case takes no new link (409 CASE_CLOSED); repeating an existing link stays 200', async () => {
      const refused = await env
        .post(`rcas/${caseId}/links`, {
          linkType: 'work_order',
          targetId: 'WO-AFTER-CLOSE',
        })
        .expect(409);
      expect((refused.body as ApiError).code).toBe('CASE_CLOSED');
      const again = (await env.linkEvent(first, { rcaId: caseId }).expect(200))
        .body as LinkResultBody;
      expect(again.created).toBe(false);
    });

    it('H1: every write on a closed investigation answers 409 CASE_CLOSED (reopen stays the only path)', async () => {
      const read = (await env.get(`rcas/${caseId}`).expect(200))
        .body as CaseBody;
      const [action] = await env.rows<{ id: string; row_version: number }>(
        `SELECT id, row_version FROM rca_actions WHERE rca_id = $1 LIMIT 1`,
        [caseId],
      );
      const [cause] = await env.rows<{ id: string; row_version: number }>(
        `SELECT id, row_version FROM rca_causes WHERE rca_id = $1 LIMIT 1`,
        [caseId],
      );
      const writes = closedCaseWrites(env, {
        caseId,
        etag: `"${read.rowVersion}"`,
        action,
        cause,
      });
      for (const write of writes) {
        const response = await write();
        expect([response.status, codeOf(response)]).toEqual([
          409,
          'CASE_CLOSED',
        ]);
      }
      const after = (await env.get(`rcas/${caseId}`).expect(200))
        .body as CaseBody;
      expect(after.rowVersion).toBe(read.rowVersion);
      await expectSweepSkips(env, action.id);
    });

    it('the repair migration applies the closure rule to recommendations of cases closed before it', async () => {
      const [done] = await env.rows<{ id: string }>(
        `SELECT id FROM rca_actions WHERE rca_id = $1 AND status = 'done' LIMIT 1`,
        [caseId],
      );
      const [cancelled] = await env.rows<{ id: string }>(
        `SELECT id FROM rca_actions WHERE rca_id = $1 AND status = 'cancelled' LIMIT 1`,
        [caseId],
      );
      const [before] = await env.rows<{ recommendations: string | null }>(
        `SELECT recommendations FROM rcas WHERE id = $1`,
        [caseId],
      );
      const items = [
        { id: 'r-done', text: 'Realign', status: 'Open' },
        { id: 'r-cancel', text: 'Replace', status: 'Open' },
        { id: 'r-none', text: 'Train', status: 'Open' },
      ];
      await env.rows(`UPDATE rcas SET recommendations = $2 WHERE id = $1`, [
        caseId,
        JSON.stringify(items),
      ]);
      await env.rows(
        `UPDATE rca_actions SET recommendation_id = CASE id WHEN $1 THEN 'r-done' ELSE 'r-cancel' END WHERE id IN ($1, $2)`,
        [done.id, cancelled.id],
      );
      const { CloseRecommendationsOfClosedCases1794221700000 } = await import(
        '../../src/database/migrations/1794221700000-CloseRecommendationsOfClosedCases'
      );
      const runner = env.harness.dataSource.createQueryRunner();
      await runner.connect();
      try {
        const migration = new CloseRecommendationsOfClosedCases1794221700000();
        await migration.up(runner);
        await migration.up(runner);
        await migration.down();
      } finally {
        await runner.release();
      }
      const [after] = await env.rows<{ recommendations: string }>(
        `SELECT recommendations FROM rcas WHERE id = $1`,
        [caseId],
      );
      expect(
        (JSON.parse(after.recommendations) as Array<{ status: string }>).map(
          (r) => r.status,
        ),
      ).toEqual(['Completed', 'Cancelled', 'Open']);
      await expectRepairHistory(env, caseId);
      await env.rows(
        `UPDATE rca_actions SET recommendation_id = NULL WHERE id IN ($1, $2)`,
        [done.id, cancelled.id],
      );
      await env.rows(`UPDATE rcas SET recommendations = $2 WHERE id = $1`, [
        caseId,
        before.recommendations,
      ]);
    });

    it('reopening a closed case needs the independent approver and a reason', async () => {
      expect(
        codeOf(await transition({ to: 'Analysis', note: 'repeat seen' })),
      ).toBe('SEPARATION_OF_DUTIES');
      expect(codeOf(await transition({ to: 'Analysis' }, env.approver))).toBe(
        'NOTE_REQUIRED',
      );
      const reopened = await transition(
        { to: 'Analysis', note: 'the trip came back' },
        env.approver,
      );
      expect(reopened.body).toMatchObject({
        status: 'Analysis',
        actualCloseDate: null,
        closureApprovedBy: null,
      });
    });
  });

  it('a linked case can be deleted (the circular FK clears the event pointer)', async () => {
    const extra = await env.createCase({
      title: 'to delete',
      unitId: env.world.unitA1,
    });
    const stopId = await env.stopEvent(env.world.unitA1, 120, 100);
    await env.linkEvent(stopId, { rcaId: extra.id }).expect(201);
    // v2 has no case delete (the v1 route is retired): the FK behaviour is checked on the row itself
    await env.rows(`DELETE FROM rcas WHERE id = $1`, [extra.id]);
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
