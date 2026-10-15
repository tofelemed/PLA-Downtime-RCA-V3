import { randomUUID } from 'crypto';
import { ApiError } from './support/plan-world';
import {
  ReconciliationBody,
  ReconciliationWorld,
} from './support/reconciliation-world';

interface ReversibleBody {
  items: Array<{
    id: string;
    kind: string;
    quantity: string;
    remainingQuantity: string;
  }>;
}

/**
 * SME R9 reversal lines on real Postgres: shift A1 is approved with a 150 t manual availability line; shift
 * B1 reverses part of that line (evidence-backed, opposite sign, at most what is left) without it touching
 * B1's own balance; once B1 is approved, C1 can only reverse what is still left.
 */
describe('reversal lines (SME R9)', () => {
  const env = new ReconciliationWorld();
  let reason = '';
  let reversedId = '';

  const approvePeriod = async (
    periodId: string,
    extra: Array<Record<string, unknown>> = [],
  ) => {
    const view = await env.view(periodId);
    const lines = [
      ...env.rejectAllPlus(view, view.slices[0].gap as string, reason),
      ...extra,
    ];
    await env.saveLines(view, lines, env.admin, periodId).expect(200);
    await env.submit(await env.view(periodId), env.admin, periodId).expect(200);
    await env
      .approve(await env.view(periodId), env.approver, periodId)
      .expect(200);
  };
  const reversal = (
    view: ReconciliationBody,
    quantity: string,
    reversesLineId = reversedId,
  ) => ({
    action: 'manual',
    sliceId: view.slices[0].sliceId,
    kind: 'reversal',
    quantity,
    reversesLineId,
    evidenceType: 'log',
    evidenceRef: 'shift log: the A1 stop was entered twice',
    reason: 'duplicate entry in shift A',
  });
  /** Saves the period's lines that explain its gap plus `extra`, answering the HTTP status. */
  const saveWith = async (
    periodId: string,
    extra: (v: ReconciliationBody) => Record<string, unknown>,
    status: number,
  ) => {
    const view = await env.view(periodId);
    const lines = [
      ...env.rejectAllPlus(view, view.slices[0].gap as string, reason),
      extra(view),
    ];
    return env.saveLines(view, lines, env.admin, periodId).expect(status);
  };
  const codeOf = async (
    periodId: string,
    extra: (v: ReconciliationBody) => Record<string, unknown>,
  ) => ((await saveWith(periodId, extra, 422)).body as ApiError).code;

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
    await approvePeriod(env.periodA1);
    const [line] = await env.rows<{ id: string }>(
      `SELECT id FROM approved_loss_lines WHERE period_id = $1 AND kind = 'availability' AND source = 'line'`,
      [env.periodA1],
    );
    if (!line)
      throw new Error(
        'the approved ledger of A1 has no manual availability line',
      );
    reversedId = line.id;
  });
  afterAll(() => env.stop());

  it('lists the approved lines of earlier periods a reversal may name', async () => {
    const body = (
      await env
        .get(`production-periods/${env.periodB1}/reversible-lines`)
        .expect(200)
    ).body as ReversibleBody;
    expect(body.items.find((i) => i.id === reversedId)).toMatchObject({
      kind: 'availability',
      quantity: '150',
      remainingQuantity: '150',
    });
  });

  it('refuses a wrong sign, more than the line, an unknown target and a missing record', async () => {
    expect(await codeOf(env.periodB1, (v) => reversal(v, '20'))).toBe(
      'REVERSAL_SIGN',
    );
    expect(await codeOf(env.periodB1, (v) => reversal(v, '-151'))).toBe(
      'REVERSAL_EXCEEDS',
    );
    expect(
      await codeOf(env.periodB1, (v) => reversal(v, '-10', randomUUID())),
    ).toBe('REVERSAL_TARGET_INVALID');
    expect(
      await codeOf(env.periodB1, (v) => ({
        ...reversal(v, '-10'),
        evidenceType: undefined,
      })),
    ).toBe('EVIDENCE_REQUIRED');
  });

  it('a valid reversal is saved and never balances the period it is entered in', async () => {
    await saveWith(env.periodB1, (v) => reversal(v, '-50'), 200);
    const view = await env.view(env.periodB1);
    const line = view.lines.find((l) => l.kind === 'reversal') as unknown as {
      quantity: string;
      reversesLineId: string;
    };
    expect(line).toMatchObject({ quantity: '-50', reversesLineId: reversedId });
    expect(view.slices[0].residual).toBe('0');
    expect(view.slices[0].attributed).toBe(view.slices[0].gap);
  });

  it('after B1 is approved, C1 may only reverse what is left', async () => {
    await env
      .submit(await env.view(env.periodB1), env.admin, env.periodB1)
      .expect(200);
    await env
      .approve(await env.view(env.periodB1), env.approver, env.periodB1)
      .expect(200);
    const body = (
      await env
        .get(`production-periods/${env.periodC1}/reversible-lines`)
        .expect(200)
    ).body as ReversibleBody;
    expect(body.items.find((i) => i.id === reversedId)?.remainingQuantity).toBe(
      '100',
    );
    // valuation 2.8.1: the approved reversal carries −50/150 of A1's approved value per view and currency
    const cells = await env.rows<{
      view: string;
      original: string | null;
      reversal: string | null;
      status: string;
    }>(
      `SELECT o."view"::text AS "view", o."amount"::text AS "original", r."amount"::text AS "reversal", r."status"
         FROM approved_loss_line_valuations o
         JOIN approved_loss_lines rl ON rl.period_id = $2 AND rl.kind = 'reversal'
         JOIN approved_loss_line_valuations r ON r.approved_line_id = rl.id
              AND r."view" = o."view" AND r.currency = o.currency
        WHERE o.approved_line_id = $1`,
      [reversedId, env.periodB1],
    );
    for (const c of cells) {
      if (c.original === null) expect(c.reversal).toBeNull();
      else expect(Number(c.reversal)).toBeCloseTo(-Number(c.original) / 3, 6);
    }
    expect(await codeOf(env.periodC1, (v) => reversal(v, '-101'))).toBe(
      'REVERSAL_EXCEEDS',
    );
    await saveWith(env.periodC1, (v) => reversal(v, '-100'), 200);
  });
});
