import { Dec } from '../../src/domain/actuals/decimal';
import { A, B, HOUR } from './support/actuals-world';
import { AccountingWorld, LineBody, plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';

type Line = LineBody & { flags: string[] };

/**
 * SME E1 on real Postgres: the transition-standard key unit × from × to × catalyst family × operating
 * mode. An "any" entry (2 h) and a Ziegler-Natta entry (2.5 h) of the same change are both approved
 * (separate version families, no overlap conflict); a 3 h grade transition recorded with catalyst
 * family `ziegler_natta` at 100 t/h is priced against the specific entry: allowance 250 t, overrun 50 t.
 * Only a grade_transition may carry the context (422 INVALID_GRADE_CHANGE).
 */
describe('transition-standard context key (SME E1)', () => {
  const env = new AccountingWorld();
  let periodA1 = '';

  const draft = async (key: string, extra: Record<string, unknown>) => {
    const created = await env
      .post('transition-standards', {
        unitId: env.world.unitA1,
        fromProductId: env.products.p1,
        toProductId: env.products.p2,
        referenceSeconds: '7200',
        effectiveFrom: '2026-01-01T00:00:00Z',
        ...extra,
      })
      .set('Idempotency-Key', `tsc-create-${key}`)
      .expect(201);
    const id = (created.body as { id: string }).id;
    await env
      .post(`transition-standards/${id}/approve`, {}, env.approver)
      .set('Idempotency-Key', `tsc-approve-${key}`)
      .expect(200);
    return created.body as { id: string; version: number };
  };

  beforeAll(async () => {
    await env.start();
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    periodA1 = await env.periodId(env.world.unitA1, A);
    await env.outputEvent(env.world.unitA1, A, B, '300');
  });
  afterAll(() => env.stop());

  it('keeps one version family per full key and prices the transition with the most specific entry', async () => {
    const any = await draft('any', {});
    const zn = await draft('zn', {
      referenceSeconds: '9000',
      catalystFamily: 'ziegler_natta',
    });
    expect(any.version).toBe(1);
    expect(zn).toMatchObject({
      version: 1,
      catalystFamily: 'ziegler_natta',
      operatingMode: null,
    });
    const transitionId = await env.lossEvent(
      env.world.unitA1,
      plus(A, HOUR),
      3,
      {
        physicalType: 'grade_transition',
        scheduleClass: 'planned',
        oeeComponent: 'performance',
        fromProductId: env.products.p1,
        toProductId: env.products.p2,
        catalystFamily: 'ziegler_natta',
        description: 'test transition',
      },
    );
    await env.settle();
    const capacity = (
      (await env.accounting(periodA1)).data.lines as Line[]
    ).filter((l) => l.ledger === 'capacity' && l.causeEventId === transitionId);
    const sum = (kind: string) =>
      capacity
        .filter((l) => l.kind === kind)
        .reduce((s, l) => s.plus(l.quantity), new Dec(0))
        .toString();
    expect(sum('transition_allowance')).toBe('250');
    expect(sum('transition_excess')).toBe('50');
    expect(
      capacity.every((l) => l.flags.includes(`transition_standard:${zn.id}`)),
    ).toBe(true);
  });

  it('refuses a catalyst family on an event that is not a grade transition', async () => {
    const response = await env
      .post('production-events', {
        unitId: env.world.unitA1,
        startTime: plus(A, 5 * HOUR),
        endTime: plus(A, 6 * HOUR),
        physicalType: 'downtime',
        catalystFamily: 'ziegler_natta',
      })
      .expect(422);
    expect((response.body as ApiError).code).toBe('INVALID_GRADE_CHANGE');
  });
});
