import { randomUUID } from 'crypto';
import { A, B, C, HOUR } from './support/actuals-world';
import { AccountingWorld, LineBody, plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';

type Line = LineBody & { flags: string[] };

interface Classes {
  firstPassGood: string | null;
  wideSpec: string;
  downgrade: string;
  scrap: string;
  rework: string;
  unclassified: string | null;
  recovered: string;
  reprocessedInput: string;
  dispositionIds: string[];
}

interface DispositionBody {
  id: string;
  state: string;
  dispositionClass: string;
  quantity: string;
  supersededAt: string | null;
}

/**
 * SME E3 on real Postgres: lot dispositions through `/v2/lot-dispositions` (maker-checker, recovery
 * rules, corrections that supersede, unit scope) classify the period actuals of the lot's production
 * interval — 300 t made in shift A with 15 t downgraded is 285 t first-pass good and one downgrade quality
 * line — and a recovery of 10 t reprocessed through the meter in shift B is recovered output, not new gross,
 * while shift A keeps its first-pass defect. A quality_loss event names its disposition class.
 * Only a Quality / Lab approver (`quality_approver`, ISO 9001 owner decision) who is not the author decides.
 */
describe('lot dispositions and the good-output boundary (SME E3)', () => {
  const env = new AccountingWorld();
  let periodA = '';
  let periodB = '';
  let downgradeId = '';
  /** Quality / Lab approvers of unit A1: `quality` decides; `lab` records one of its own. */
  let quality = '';
  let lab = '';

  const body = (extra: Record<string, unknown> = {}) => ({
    unitId: env.world.unitA1,
    productId: env.products.p1,
    lotCode: 'L-0301-A',
    dispositionClass: 'downgrade',
    quantity: '15',
    uom: 't',
    productionStart: A,
    productionEnd: B,
    labReleasedAt: plus(B, 3 * HOUR),
    evidenceRef: 'LIMS-0301-A',
    ...extra,
  });
  const propose = async (
    extra: Record<string, unknown> = {},
    token = env.admin,
  ) =>
    (
      await env
        .post('lot-dispositions', body(extra), token)
        .set('Idempotency-Key', randomUUID())
        .expect(201)
    ).body as DispositionBody;
  const approve = (id: string) =>
    env
      .post(`lot-dispositions/${id}/approve`, {}, quality)
      .set('Idempotency-Key', randomUUID());
  const refused = async (extra: Record<string, unknown>) =>
    (
      (
        await env
          .post('lot-dispositions', body(extra))
          .set('Idempotency-Key', randomUUID())
          .expect(422)
      ).body as ApiError
    ).code;
  const actuals = async (periodId: string) => {
    const detail = await env.detail(periodId);
    const slice = detail.data.slices[0]?.actuals;
    if (!slice) throw new Error('slice without actuals');
    return slice as typeof slice & { qualityClasses: Classes | null };
  };
  const qualityLines = async (periodId: string) =>
    ((await env.accounting(periodId)).data.lines as Line[]).filter(
      (l) => l.ledger === 'capacity' && l.kind === 'quality',
    );

  beforeAll(async () => {
    await env.start();
    quality = await env.unitUser(env.world.unitA1, 'quality_approver');
    lab = await env.unitUser(env.world.unitA1, 'quality_approver');
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    periodA = await env.periodId(env.world.unitA1, A);
    periodB = await env.periodId(env.world.unitA1, B);
    await env.outputEvent(env.world.unitA1, A, B, '300');
    await env.outputEvent(env.world.unitA1, B, C, '310');
    await env.settle();
  });
  afterAll(() => env.stop());

  it('E3: an approved 15 t downgrade of the 300 t made in shift A → 285 t first-pass good, one downgrade line', async () => {
    const proposed = await propose();
    downgradeId = proposed.id;
    expect(proposed).toMatchObject({ state: 'proposed', quantity: '15' });
    for (const manager of [env.admin, env.approver]) {
      const refusedRole = await env
        .post(`lot-dispositions/${downgradeId}/approve`, {}, manager)
        .set('Idempotency-Key', randomUUID())
        .expect(403);
      expect((refusedRole.body as ApiError).code).toBe('FORBIDDEN_ROLE');
    }
    await approve(downgradeId).expect(200);
    await env.settle();
    const result = await actuals(periodA);
    expect(result).toMatchObject({ gross: '300', reject: '15', good: '285' });
    expect(result.qualityClasses).toMatchObject({
      firstPassGood: '285',
      downgrade: '15',
      dispositionIds: [downgradeId],
    });
    expect(result.exceptions.map((e) => e.code)).toContain(
      'rejects_from_dispositions',
    );
    const lines = await qualityLines(periodA);
    expect(lines.map((l) => [l.quantity, l.flags])).toEqual([
      ['15', ['no_cause', 'quality_class:downgrade']],
    ]);
  });

  it('refuses an impossible disposition or recovery with a specific 422', async () => {
    const scrap = await propose({ dispositionClass: 'scrap', quantity: '1' });
    await approve(scrap.id).expect(200);
    expect(await refused({ dispositionClass: 'recovered' })).toBe(
      'INVALID_RECOVERY',
    );
    expect(await refused({ remeasured: true })).toBe('INVALID_RECOVERY');
    expect(
      await refused({ dispositionClass: 'recovered', recoveryOfId: scrap.id }),
    ).toBe('NOT_RECOVERABLE');
    expect(
      await refused({
        dispositionClass: 'recovered',
        recoveryOfId: downgradeId,
        quantity: '16',
        productionStart: B,
        productionEnd: C,
      }),
    ).toBe('RECOVERY_EXCEEDS_DISPOSITION');
    expect(await refused({ productionEnd: '2031-01-01T00:00:00Z' })).toBe(
      'INVALID_RANGE',
    );
    expect(await refused({ productId: env.products.pB })).toBe(
      'INVALID_REFERENCE',
    );
    await env
      .post(`lot-dispositions/${scrap.id}/reject`, { reason: 'twice' }, quality)
      .set('Idempotency-Key', randomUUID())
      .expect(409);
  });

  it('rework round trip: 10 t reprocessed through the meter in shift B are recovered output, not new gross', async () => {
    const recovery = await propose({
      lotCode: 'L-0301-A/R1',
      dispositionClass: 'recovered',
      recoveryOfId: downgradeId,
      quantity: '10',
      remeasured: true,
      productionStart: plus(B, HOUR),
      productionEnd: plus(B, 2 * HOUR),
    });
    await approve(recovery.id).expect(200);
    await env.settle();
    const shiftB = await actuals(periodB);
    expect(shiftB).toMatchObject({ gross: '300', good: '300' });
    expect(shiftB.qualityClasses).toMatchObject({
      recovered: '10',
      reprocessedInput: '10',
      firstPassGood: '300',
    });
    expect(await qualityLines(periodB)).toEqual([]);
    const shiftA = await actuals(periodA);
    expect(shiftA.good).toBe('284');
    expect(shiftA.qualityClasses?.downgrade).toBe('15');
  });

  it('a correction supersedes the approved disposition; the old row stays as evidence', async () => {
    const scrap = await propose({ dispositionClass: 'scrap', quantity: '5' });
    await approve(scrap.id).expect(200);
    await env.settle();
    expect((await actuals(periodA)).good).toBe('279');
    const correction = await propose({
      dispositionClass: 'scrap',
      quantity: '3',
      supersedesId: scrap.id,
    });
    await approve(correction.id).expect(200);
    await env.settle();
    expect((await actuals(periodA)).good).toBe('281');
    const old = await env.get(`lot-dispositions/${scrap.id}`).expect(200);
    expect(old.body).toMatchObject({ state: 'superseded' });
    expect((old.body as DispositionBody).supersededAt).not.toBeNull();
  });

  it('lists by unit and production interval; another unit’s user cannot read them', async () => {
    const list = await env
      .get(
        `lot-dispositions?unitId=${env.world.unitA1}&state=approved&from=${A}&to=${B}&limit=2`,
      )
      .expect(200);
    const page = list.body as { items: DispositionBody[]; nextCursor: string };
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toEqual(expect.any(String));
    const outsider = await env.unitUser(env.world.unitA2);
    await env.get(`lot-dispositions/${downgradeId}`, outsider).expect(404);
    const scoped = await env.get('lot-dispositions', outsider).expect(200);
    expect((scoped.body as { items: unknown[] }).items).toEqual([]);
  });

  it('a quality_loss event names its disposition class; another event type cannot', async () => {
    const created = await env
      .post('production-events', {
        unitId: env.world.unitA1,
        startTime: plus(A, HOUR),
        endTime: plus(A, 2 * HOUR),
        physicalType: 'quality_loss',
        quantity: '2',
        quantityUom: 't',
        dispositionClass: 'scrap',
        description: 'off-spec melt index',
      })
      .expect(201);
    const id = (created.body as { id: string }).id;
    const read = await env.get(`production-events/${id}`).expect(200);
    expect(read.body).toMatchObject({ dispositionClass: 'scrap' });
    const wrong = await env
      .post('production-events', {
        unitId: env.world.unitA1,
        startTime: plus(A, 3 * HOUR),
        endTime: plus(A, 4 * HOUR),
        physicalType: 'downtime',
        dispositionClass: 'scrap',
        description: 'test stop',
      })
      .expect(422);
    expect((wrong.body as ApiError).code).toBe('INVALID_DISPOSITION_CLASS');
    await env.settle();
    const lines = await qualityLines(periodA);
    expect(lines.find((l) => l.causeEventId === id)?.flags).toContain(
      'quality_class:scrap',
    );
  });

  it('a quality approver records a disposition but never decides it; another quality approver does', async () => {
    const own = await propose(
      { dispositionClass: 'scrap', quantity: '1' },
      lab,
    );
    const self = await env
      .post(`lot-dispositions/${own.id}/approve`, {}, lab)
      .set('Idempotency-Key', randomUUID())
      .expect(403);
    expect((self.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    const rejected = await env
      .post(
        `lot-dispositions/${own.id}/reject`,
        { reason: 'lab retest' },
        quality,
      )
      .set('Idempotency-Key', randomUUID())
      .expect(200);
    expect(rejected.body).toMatchObject({ state: 'rejected' });
  });
});
