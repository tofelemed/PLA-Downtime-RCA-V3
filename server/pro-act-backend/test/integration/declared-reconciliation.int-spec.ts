import { A, B, C, NEXT_DAY } from './support/actuals-world';
import { ApiError } from './support/plan-world';
import {
  ReconciliationBody,
  ReconciliationWorld,
} from './support/reconciliation-world';
import { EventRevisionService } from '../../src/production-event/revisions/event-revision.service';

const POLICY = {
  grain: 'shift',
  dayStart: '06:00',
  lossBasis: 'declared',
  targetSource: 'declared',
  accountingUnitId: null,
  stopsCrossCheck: true,
  identityTolerance: 0,
};

const FIGURES = { planned: 1000, actual: 850, shortfall: 150, uom: 't' };

const tolerance = (gate: 'warn' | 'block', over: object = {}) => ({
  mode: 'zero',
  value: 0,
  epsilon: 0.000001,
  allowUnaccountedClassification: false,
  submitGate: { mode: gate, codedRatioTarget: 0.95 },
  dayGate: { mode: 'warn', codedRatioTarget: 0.99 },
  ...over,
});

interface CodingGateBody {
  mode: string;
  passes: boolean;
  issues: Array<{ code: string }>;
}

/**
 * Declared mode through the reconciliation workflow on real Postgres (spec §4.4, D8): with a unit
 * `loss_accounting` policy `lossBasis = declared`, the coding gate counts the production loss events
 * (warn or block per the tolerance policy), an uncoded event keeps its shortfall unaccounted, approval
 * waits for OT's CONFIRMED status (409 DECLARED_NOT_CONFIRMED), and an identity mismatch blocks the
 * submission until the difference is booked as a tolerance line. Test data only.
 */
describe('declared-mode reconciliation workflow (spec §4.4, D8)', () => {
  const env = new ReconciliationWorld();
  let reason = '';

  const declare = async (
    from: string,
    to: string,
    extra: Record<string, unknown>,
  ): Promise<string> => {
    const created = await env
      .post('production-events', {
        unitId: env.world.unitA1,
        startTime: from,
        endTime: to,
        physicalType: 'production_loss',
        ...extra,
      })
      .expect(201);
    await env.settle();
    return (created.body as { id: string }).id;
  };

  const manual150 = (view: ReconciliationBody) => ({
    action: 'manual',
    sliceId: view.slices[0].sliceId,
    kind: 'availability',
    quantity: '150',
    missingEvent: true,
    evidenceType: 'log',
    evidenceRef: 'shift log',
    reasonCodeId: reason,
  });

  const gateOf = async (periodId: string): Promise<CodingGateBody> =>
    (await env.view(periodId)).codingGate as CodingGateBody;

  const reviseSource = (
    eventId: string,
    from: string,
    to: string,
    declaredFigures: object,
  ) =>
    env.app
      .get(EventRevisionService)
      .applySourceRevision(
        eventId,
        { startTime: from, endTime: to, declaredFigures },
        { actorKind: 'connector' },
      );

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
    await env.rows(
      `UPDATE reason_codes SET default_oee_component = 'availability' WHERE id = $1`,
      [reason],
    );
    await env.rows(
      `INSERT INTO accounting_policies (tenant_id, row_version, policy_kind, unit_id, scope_key, version, body,
              effective_from, approved_at)
       VALUES ($1, 1, 'loss_accounting', $2::uuid, $2, 1, $3::jsonb, '2026-01-01T00:00:00Z', now())`,
      [env.world.tenantA, env.world.unitA1, JSON.stringify(POLICY)],
    );
    await env.tolerancePolicy(env.world.unitA1, tolerance('warn'));
    await env.recompute(env.periodA1);
    await env.recompute(env.periodB1);
    await env.recompute(env.periodC1);
  });
  afterAll(() => env.stop());

  it('mode warn: an uncoded loss event is reported but does not refuse the submission', async () => {
    await declare(B, C, {
      declaredFigures: { ...FIGURES, sourceStatus: 'CONFIRMED' },
    });
    const gate = await gateOf(env.periodB1);
    expect(gate).toMatchObject({ mode: 'warn', passes: false });
    expect(gate.issues.map((i) => i.code)).toContain('LOSS_EVENT_UNCODED');

    const bare = await env.view(env.periodB1);
    expect(bare.slices[0]).toMatchObject({ gap: '150', residual: '150' });
    const refused = await env.submit(bare, env.admin, env.periodB1).expect(422);
    expect((refused.body as ApiError).code).toBe('RESIDUAL_UNEXPLAINED');

    await env
      .saveLines(bare, [manual150(bare)], env.admin, env.periodB1)
      .expect(200);
    const view = await env.view(env.periodB1);
    const submitted = await env.submit(view, env.admin, env.periodB1);
    expect(submitted.status).toBe(200);
  });

  it('mode block: the uncoded event refuses the submission; coding it clears the gate', async () => {
    await env.tolerancePolicy(env.world.unitA1, tolerance('block'));
    const id = await declare(C, NEXT_DAY, {
      declaredFigures: { ...FIGURES, sourceStatus: 'CONFIRMED' },
    });
    await env.recompute(env.periodC1);
    const view = await env.view(env.periodC1);
    const refused = await env.submit(view, env.admin, env.periodC1).expect(422);
    expect((refused.body as ApiError).code).toBe('CODING_INCOMPLETE');
    expect(JSON.stringify(refused.body)).toContain('LOSS_EVENT_UNCODED');

    await env.rows(
      `UPDATE production_events SET reason_code_id = $1, row_version = row_version + 1 WHERE id = $2`,
      [reason, id],
    );
    await env.recompute(env.periodC1);
    expect(await gateOf(env.periodC1)).toMatchObject({
      mode: 'block',
      passes: true,
    });
    const coded = await env.view(env.periodC1);
    expect(coded.slices[0]).toMatchObject({ residual: '0' });
    await env.submit(coded, env.admin, env.periodC1).expect(200);
  });

  it('D8: approval is refused while OT has not confirmed, and succeeds after the CONFIRMED revision', async () => {
    const id = await declare(A, B, {
      reasonCodeId: reason,
      declaredFigures: { ...FIGURES, sourceStatus: 'DETECTED' },
    });
    await env.recompute(env.periodA1);
    const view = await env.view(env.periodA1);
    const submitted = (await env.submit(view).expect(200))
      .body as ReconciliationBody;
    const refused = await env.approve(submitted).expect(409);
    expect((refused.body as ApiError).code).toBe('DECLARED_NOT_CONFIRMED');

    await reviseSource(id, A, B, { ...FIGURES, sourceStatus: 'CONFIRMED' });
    await env.settle();
    await env
      .post(
        `production-periods/${env.periodA1}/reject`,
        {
          revision: submitted.revision.revision,
          reason: 'OT confirmed the loss',
        },
        env.approver,
      )
      .expect(200);
    await env.recompute(env.periodA1);
    const redone = await env.view(env.periodA1);
    const resubmitted = (await env.submit(redone).expect(200))
      .body as ReconciliationBody;
    const approved = (await env.approve(resubmitted).expect(200))
      .body as ReconciliationBody;
    expect(approved.revision.lifecycle).toBe('approved');
  });

  it('an identity mismatch refuses the submission until the difference is booked as a tolerance line', async () => {
    const view = await env.view(env.periodC1);
    await env
      .post(
        `production-periods/${env.periodC1}/reject`,
        { revision: view.revision.revision, reason: 'OT revises the event' },
        env.approver,
      )
      .expect(200);
    const events = await env.rows<{ id: string }>(
      `SELECT id FROM production_events WHERE unit_id = $1 AND physical_type = 'production_loss' AND start_time = $2`,
      [env.world.unitA1, C],
    );
    await reviseSource(events[0].id, C, NEXT_DAY, {
      ...FIGURES,
      shortfall: 140,
      sourceStatus: 'CONFIRMED',
    });
    await env.settle();
    await env.recompute(env.periodC1);
    const mismatch = await env.view(env.periodC1);
    expect(mismatch.slices[0].flags).toContain('declared_identity_mismatch');
    const open = await env
      .submit(mismatch, env.admin, env.periodC1)
      .expect(422);
    expect((open.body as ApiError).code).toBe('OPEN_REVIEW_ITEMS');
    const [item] = await env.rows<{ id: string }>(
      `SELECT id FROM event_review_items WHERE event_id = $1 AND state = 'open'`,
      [events[0].id],
    );
    await env
      .post(`event-review-items/${item.id}/resolve`, { decision: 'dismiss' })
      .expect(200);
    const refused = await env
      .submit(mismatch, env.admin, env.periodC1)
      .expect(422);
    const issues = (
      refused.body as { details: { issues: Array<{ code: string }> } }
    ).details.issues.map((i) => i.code);
    expect(issues).toContain('DECLARED_IDENTITY_MISMATCH');

    await env.tolerancePolicy(
      env.world.unitA1,
      tolerance('block', { mode: 'percent', value: 1 }),
    );
    await env.recompute(env.periodC1);
    const within = await env.view(env.periodC1);
    const ok = await env.submit(within, env.admin, env.periodC1).expect(200);
    expect((ok.body as ReconciliationBody).lines).toContainEqual(
      expect.objectContaining({ action: 'tolerance', quantity: '10' }),
    );
  });

  it('the day coding gate counts the production loss events of the day, not stops', async () => {
    const path = `production-days/${env.world.unitA1}/2027-03-01`;
    const day = async () =>
      (
        (await env.get(path).expect(200)).body as {
          codingGate: CodingGateBody & { codedRatio: string };
        }
      ).codingGate;
    const open = await day();
    expect(open).toMatchObject({
      mode: 'warn',
      passes: false,
      stops: 3,
      uncoded: 1,
    });
    expect(open.issues.map((i) => i.code)).toEqual([
      'LOSS_EVENT_UNCODED',
      'CODING_COVERAGE_LOW',
    ]);
    expect(Number(open.codedRatio)).toBeCloseTo(290 / 440, 6);

    await env.rows(
      `UPDATE production_events SET reason_code_id = $1, row_version = row_version + 1
        WHERE unit_id = $2 AND physical_type = 'production_loss' AND start_time = $3`,
      [reason, env.world.unitA1, B],
    );
    expect(await day()).toMatchObject({
      passes: true,
      uncoded: 0,
      codedRatio: '1',
    });
  });

  it('an empty computed period (no slice, default policy) is not submittable or certifiable', async () => {
    const unit = env.world.unitA2;
    // computed mode: the unit has no loss_accounting policy yet (the declared test below adds one)
    const policies = await env.rows<{ count: number }>(
      `SELECT count(*)::int AS "count" FROM accounting_policies
        WHERE policy_kind = 'loss_accounting' AND unit_id = $1`,
      [unit],
    );
    expect(policies[0].count).toBe(0);
    const starts = [
      NEXT_DAY,
      '2027-03-02T10:30:00.000Z',
      '2027-03-02T18:30:00.000Z',
    ];
    await env.materialize([unit], NEXT_DAY, '2027-03-03T02:30:00.000Z');
    const ids = await Promise.all(starts.map((at) => env.periodId(unit, at)));
    for (const id of ids) await env.recompute(id);
    const empty = await env.view(ids[0]);
    expect(empty.slices).toEqual([]);
    const refused = await env.submit(empty, env.admin, ids[0]).expect(422);
    expect(refused.body).toMatchObject({
      code: 'NO_COMPUTABLE_SLICE',
      message:
        'The calculation produced no computable slice; fix the period setup (see its warnings) and recompute before submitting.',
    });

    // approved before the gate existed: the day still cannot be certified
    await env.rows(
      `UPDATE accounting_revisions SET lifecycle = 'approved' WHERE period_id = ANY($1::uuid[])`,
      [ids],
    );
    const certify = await env
      .post(`production-days/${unit}/2027-03-02/certify`, {}, env.approver)
      .expect(422);
    expect(certify.body).toMatchObject({
      code: 'DAY_NOT_READY',
      message:
        'A period of this day has no computable figures; revise and recompute it before certifying.',
    });
    expect(JSON.stringify(certify.body)).toContain('NO_COMPUTABLE_SLICE');
  });

  it('an empty declared period (no slice) is not submittable, approvable or certifiable', async () => {
    const unit = env.world.unitA2;
    await env.rows(
      `INSERT INTO accounting_policies (tenant_id, row_version, policy_kind, unit_id, scope_key, version, body,
              effective_from, approved_at)
       VALUES ($1, 1, 'loss_accounting', $2::uuid, $2, 1, $3::jsonb, '2026-01-01T00:00:00Z', now())`,
      [env.world.tenantA, unit, JSON.stringify(POLICY)],
    );
    await env.materialize([unit], A, NEXT_DAY);
    const periods = [A, B, C];
    const ids = await Promise.all(periods.map((at) => env.periodId(unit, at)));
    for (const id of ids) await env.recompute(id);
    const empty = await env.view(ids[0]);
    expect(empty.slices).toEqual([]);
    const refused = await env.submit(empty, env.admin, ids[0]).expect(422);
    expect(refused.body).toMatchObject({ code: 'NO_COMPUTABLE_SLICE' });

    // approved before the gate existed: the day still cannot be certified
    await env.rows(
      `UPDATE accounting_revisions SET lifecycle = 'approved' WHERE period_id = ANY($1::uuid[])`,
      [ids],
    );
    const day = await env
      .post(`production-days/${unit}/2027-03-01/certify`, {}, env.approver)
      .expect(422);
    expect(day.body).toMatchObject({ code: 'DAY_NOT_READY' });
    expect(JSON.stringify(day.body)).toContain('NO_COMPUTABLE_SLICE');
  });

  it('a recompute re-resolves the slices of a slice-less period', async () => {
    const unit = env.world.unitA2;
    const start = '2027-03-03T02:30:00.000Z';
    // declared policy without accounting product, two approved profiles, no plan: no slice
    await env.materialize([unit], start, '2027-03-03T10:30:00.000Z');
    const id = await env.periodId(unit, start);
    const bare = await env.recompute(id);
    expect(bare.data.slices).toEqual([]);
    expect(bare.data.warnings.map((w) => w.code)).toContain(
      'ambiguous_default_product',
    );

    await env.rows(
      `INSERT INTO accounting_policies (tenant_id, row_version, policy_kind, unit_id, scope_key, version, body,
              effective_from, approved_at)
       VALUES ($1, 1, 'loss_accounting', $2::uuid, $2, 2, $3::jsonb, '2026-01-01T00:00:00Z', now())`,
      [
        env.world.tenantA,
        unit,
        JSON.stringify({ ...POLICY, accountingProductId: env.products.p1 }),
      ],
    );
    const resolved = await env.recompute(id);
    expect(resolved.data.slices).toEqual([
      expect.objectContaining({
        productId: env.products.p1,
        source: 'profile_default',
      }),
    ]);
    expect(resolved.data.warnings.map((w) => w.code)).not.toContain(
      'ambiguous_default_product',
    );
    expect((await env.view(id)).slices).toHaveLength(1);
  });
});
