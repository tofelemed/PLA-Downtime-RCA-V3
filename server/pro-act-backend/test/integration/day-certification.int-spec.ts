import { RECONCILIATION_TOLERANCE_DEFAULT } from '../../src/periods/engine-policy-bodies';
import { plus } from './support/accounting-world';
import { A, HOUR } from './support/actuals-world';
import { ApiError } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';

interface DayBody {
  state: string;
  periods: Array<{
    periodId: string;
    workflow: string;
    shiftName: string | null;
  }>;
  certification: {
    state: string;
    reopenReason: string | null;
    revisions: unknown[];
  } | null;
  rollup: Array<{
    uom: string | null;
    periods: number;
    target: string | null;
    actual: string | null;
  }>;
  codingGate: {
    mode: string;
    target: string;
    stops: number;
    uncoded: number;
    codedRatio: string | null;
    passes: boolean;
  } | null;
}

const DAY = '2027-03-01';

/**
 * Owner decision 14 Oct 2026 / SME R2 (phase R-E) on real Postgres: the three 8 h shifts of 1 Mar 2027 on
 * unit A1 are prepared and approved per shift; one approval certifies the day's roll-up (3 × 850 t = 2550
 * t, each quantity stored once on its shift); the certifier is never a submitter of a shift; a revise of a
 * shift reopens the certification (the correction path). SME D12 daily target: an uncoded stop of shift A
 * fails the day's coding gate; a `block` `dayGate` refuses the certification, `warn` (99 %) only shows it.
 */
describe('day certification over the shift periods (SME R2)', () => {
  const env = new ReconciliationWorld();
  let reason = '';
  const path = () => `production-days/${env.world.unitA1}/${DAY}`;

  const day = async () => (await env.get(path()).expect(200)).body as DayBody;

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 0.25);
    await env.settle();
  });
  afterAll(() => env.stop());

  it('a day with shifts not approved is open and cannot be certified (422 DAY_NOT_READY)', async () => {
    const open = await day();
    expect(open.state).toBe('open');
    expect(open.periods.map((p) => p.shiftName)).toEqual(['A', 'B', 'C']);
    // Marun regression R2: the ratio covers the same shifts as the count, approved or not
    expect(open.codingGate).toMatchObject({ stops: 1, uncoded: 1 });
    expect(open.codingGate?.codedRatio).not.toBeNull();
    expect(Number(open.codingGate?.codedRatio)).toBe(0);
    const refused = await env
      .post(`${path()}/certify`, {}, env.approver)
      .expect(422);
    expect((refused.body as ApiError).code).toBe('DAY_NOT_READY');
  });

  it('once every shift is approved the day is ready; its roll-up sums the shifts once', async () => {
    for (const periodId of [env.periodA1, env.periodB1, env.periodC1]) {
      const view = await env.view(periodId);
      await env
        .saveLines(
          view,
          env.rejectAllPlus(view, view.slices[0].gap as string, reason),
          env.admin,
          periodId,
        )
        .expect(200);
      await env
        .submit(await env.view(periodId), env.admin, periodId)
        .expect(200);
      await env
        .approve(await env.view(periodId), env.approver, periodId)
        .expect(200);
    }
    const ready = await day();
    expect(ready.state).toBe('ready');
    expect(ready.rollup).toEqual([
      expect.objectContaining({
        uom: 't',
        periods: 3,
        target: '3000',
        actual: '2550',
      }),
    ]);
    expect(ready.codingGate).toMatchObject({
      mode: 'warn',
      target: '0.99',
      stops: 1,
      uncoded: 1,
      passes: false,
    });
  });

  it('D12: a block daily gate refuses the certification while the day is not coded (422 CODING_INCOMPLETE)', async () => {
    await env.tolerancePolicy(env.world.unitA1, {
      ...RECONCILIATION_TOLERANCE_DEFAULT,
      dayGate: { mode: 'block', codedRatioTarget: 0.99 },
    });
    expect((await day()).codingGate?.mode).toBe('block');
    const refused = await env
      .post(`${path()}/certify`, {}, env.approver)
      .expect(422);
    expect((refused.body as ApiError).code).toBe('CODING_INCOMPLETE');
    await env.tolerancePolicy(env.world.unitA1, {
      ...RECONCILIATION_TOLERANCE_DEFAULT,
      dayGate: { mode: 'warn', codedRatioTarget: 0.99 },
    });
  });

  it('the certifier is never a submitter of a shift, and only plant management certifies', async () => {
    const own = await env.post(`${path()}/certify`, {}, env.admin).expect(403);
    expect((own.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    const engineer = env.user('Engineer');
    await env.post(`${path()}/certify`, {}, engineer).expect(403);
  });

  it('one approval certifies the day; it is listed certified and cannot be certified twice', async () => {
    const certified = (
      await env
        .post(
          `${path()}/certify`,
          { comment: 'Demo: day reconciled' },
          env.approver,
        )
        .expect(200)
    ).body as DayBody;
    expect(certified.state).toBe('certified');
    expect(certified.certification?.revisions).toHaveLength(3);
    const twice = await env
      .post(`${path()}/certify`, {}, env.approver)
      .expect(409);
    expect((twice.body as ApiError).code).toBe('DAY_CERTIFIED');
    const list = (
      await env
        .get(
          `production-days?unitId=${env.world.unitA1}&from=2027-02-28&to=2027-03-02`,
        )
        .expect(200)
    ).body as { items: Array<{ localDate: string; state: string }> };
    expect(list.items).toEqual([
      expect.objectContaining({ localDate: DAY, state: 'certified' }),
    ]);
    const tooLong = await env
      .get(
        `production-days?unitId=${env.world.unitA1}&from=2027-01-01&to=2027-06-01`,
      )
      .expect(422);
    expect((tooLong.body as ApiError).code).toBe('INVALID_RANGE');
  });

  it('a revise of a shift reopens the certification (the correction path)', async () => {
    const view = await env.view(env.periodB1);
    await env
      .post(
        `production-periods/${env.periodB1}/revise`,
        {
          approvedRevision: view.revision.revision,
          reason: 'Demo: late lab result',
        },
        env.approver,
      )
      .expect(201);
    const reopened = await day();
    expect(reopened.state).toBe('open');
    expect(reopened.certification).toMatchObject({
      state: 'reopened',
      reopenReason: 'Demo: late lab result',
    });
  });
});
