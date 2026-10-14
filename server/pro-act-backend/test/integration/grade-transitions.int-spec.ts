import { Dec } from '../../src/domain/actuals/decimal';
import { A, B, HOUR } from './support/actuals-world';
import { AccountingWorld, LineBody, plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';

type Line = LineBody & { flags: string[]; oeeComponent: string | null };

/**
 * LA-08 / SME Q9, Q10, E1 on real Postgres: the transition matrix through `/v2/transition-standards`
 * (maker-checker, references, keyset list), a grade_transition event P1→P2 of 3 h against a 2 h
 * reference split into allowance and overrun in both ledgers, the standard recorded in the run
 * fingerprint, and a ramp-up after a trip charged to the trip (cause_event_id) with its own evidence.
 */
describe('grade transitions (LA-08)', () => {
  const env = new AccountingWorld();
  let periodA1 = '';
  let standardId = '';
  let transitionId = '';
  let tripId = '';
  let rampId = '';

  const standardBody = (extra: Record<string, unknown> = {}) => ({
    unitId: env.world.unitA1,
    fromProductId: env.products.p1,
    toProductId: env.products.p2,
    referenceSeconds: '7200',
    sampleCount: 5,
    evidence: 'test reference',
    effectiveFrom: '2026-01-01T00:00:00Z',
    ...extra,
  });

  const lines = async () =>
    (await env.accounting(periodA1)).data.lines as Line[];
  const sum = (items: readonly Line[]) =>
    items.reduce((s, l) => s.plus(l.quantity), new Dec(0));

  beforeAll(async () => {
    await env.start();
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    periodA1 = await env.periodId(env.world.unitA1, A);
    await env.outputEvent(env.world.unitA1, A, B, '300');
  });
  afterAll(() => env.stop());

  it('drafts a standard; its author cannot approve it, another approver can', async () => {
    const created = await env
      .post('transition-standards', standardBody())
      .set('Idempotency-Key', 'gt-create-1')
      .expect(201);
    standardId = (created.body as { id: string }).id;
    expect(created.body).toMatchObject({
      state: 'draft',
      version: 1,
      referenceSeconds: '7200',
      sampleCount: 5,
    });
    const own = await env
      .post(`transition-standards/${standardId}/approve`, {})
      .set('Idempotency-Key', 'gt-approve-own')
      .expect(403);
    expect((own.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    const approved = await env
      .post(`transition-standards/${standardId}/approve`, {}, env.approver)
      .set('Idempotency-Key', 'gt-approve-1')
      .expect(200);
    expect(approved.body).toMatchObject({ state: 'approved' });
    const list = await env
      .get(`transition-standards?unitId=${env.world.unitA1}&state=approved`)
      .expect(200);
    expect((list.body as { items: Array<{ id: string }> }).items).toEqual([
      expect.objectContaining({ id: standardId }),
    ]);
  });

  it('refuses a change to the same product and a product of another tenant', async () => {
    const same = await env
      .post('transition-standards', standardBody({ toProductId: env.products.p1 }))
      .set('Idempotency-Key', 'gt-same')
      .expect(422);
    expect((same.body as ApiError).code).toBe('SAME_PRODUCT');
    const foreign = await env
      .post('transition-standards', standardBody({ toProductId: env.products.pB }))
      .set('Idempotency-Key', 'gt-foreign')
      .expect(422);
    expect((foreign.body as ApiError).code).toBe('INVALID_REFERENCE');
  });

  it('a grade_transition event needs two different products', async () => {
    const response = await env
      .post('production-events', {
        unitId: env.world.unitA1,
        startTime: plus(A, HOUR),
        endTime: plus(A, 2 * HOUR),
        physicalType: 'grade_transition',
      })
      .expect(422);
    expect((response.body as ApiError).code).toBe('INVALID_GRADE_CHANGE');
  });

  it('splits a 3 h transition against the 2 h reference: allowance 200 t, overrun 100 t at 100 t/h', async () => {
    transitionId = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 3, {
      physicalType: 'grade_transition',
      scheduleClass: 'planned',
      oeeComponent: 'performance',
      fromProductId: env.products.p1,
      toProductId: env.products.p2,
      description: 'test transition',
    });
    await env.settle();
    const all = await lines();
    const capacity = all.filter(
      (l) => l.ledger === 'capacity' && l.causeEventId === transitionId,
    );
    const allowance = capacity.filter((l) => l.kind === 'transition_allowance');
    const excess = capacity.filter((l) => l.kind === 'transition_excess');
    expect(sum(allowance).toString()).toBe('200');
    expect(sum(excess).toString()).toBe('100');
    expect(excess.every((l) => l.flags.includes('transition_overrun'))).toBe(true);
    expect(
      capacity.every((l) => l.flags.includes(`transition_standard:${standardId}`)),
    ).toBe(true);
    expect(capacity.every((l) => l.oeeComponent === 'performance')).toBe(true);
    const plan = all.filter(
      (l) => l.ledger === 'plan' && l.causeEventId === transitionId,
    );
    const planAllowance = sum(plan.filter((l) => l.kind === 'transition_allowance'));
    const planExcess = sum(plan.filter((l) => l.kind === 'transition_excess'));
    expect(planAllowance.div(planExcess).toDecimalPlaces(6).toString()).toBe('2');
    const [run] = await env.rows<{ ids: string[] }>(
      `SELECT r."input_fingerprint"->'transitionStandardIds' AS "ids"
         FROM "calculation_runs" r JOIN "accounting_revisions" ar ON ar."current_run_id" = r."id"
        WHERE ar."period_id" = $1`,
      [periodA1],
    );
    expect(run.ids).toEqual([standardId]);
  });

  it('a ramp-up after a trip is charged to the trip, flagged trip_recovery, evidence on the ramp-up', async () => {
    tripId = await env.lossEvent(env.world.unitA1, plus(A, 5 * HOUR), 1);
    const notAStop = await env
      .post('production-events', {
        unitId: env.world.unitA1,
        startTime: plus(A, 6 * HOUR),
        endTime: plus(A, 7 * HOUR),
        physicalType: 'slowdown',
        impactMode: 'fractional',
        impactFraction: '0.5',
        recoveryOfEventId: transitionId,
      })
      .expect(422);
    expect((notAStop.body as ApiError).code).toBe('INVALID_REFERENCE');
    rampId = await env.lossEvent(env.world.unitA1, plus(A, 6 * HOUR), 1, {
      physicalType: 'slowdown',
      oeeComponent: 'performance',
      impactMode: 'fractional',
      impactFraction: '0.5',
      recoveryOfEventId: tripId,
      description: 'test ramp-up',
    });
    await env.settle();
    const ramp = (await lines()).filter(
      (l) =>
        l.ledger === 'capacity' &&
        l.kind === 'performance' &&
        l.evidence.some((e) => e.eventId === rampId),
    );
    expect(sum(ramp).toString()).toBe('50');
    expect(ramp.every((l) => l.causeEventId === tripId)).toBe(true);
    expect(ramp.every((l) => l.flags.includes('trip_recovery'))).toBe(true);
  });
});
