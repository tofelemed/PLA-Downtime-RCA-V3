import { DataSource } from 'typeorm';
import { approvedImpact } from '../../src/rca-case/approved-impact';
import { A, HOUR, NEXT_DAY } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { DAY1 } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';

interface TreeBody {
  data: {
    groups: Array<{
      key: string | null;
      amount: string | null;
      unit: string | null;
    }>;
    totals: Array<{ unit: string | null }>;
  };
}

/**
 * VA-01b on real Postgres: after approval, the plan-ledger loss tree and the RCA approved impact read the
 * approved lines — a rejected stop candidate contributes nothing, the manual line that replaced it shows
 * under its own reason with its own quantity.
 */
describe('approved ledger lines feed the loss tree and RCA impact (VA-01b)', () => {
  const env = new ReconciliationWorld();
  let stopId = '';
  let feed = '';
  let power = '';

  beforeAll(async () => {
    await env.start();
    feed = await env.reasonCode('FEED');
    power = await env.reasonCode('POWER');
    stopId = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1, {
      reasonCodeId: feed,
    });
    await env.settle();
    const view = await env.view();
    const candidate = view.candidates.find((c) => c.causeEventId === stopId)!;
    await env
      .saveLines(view, [
        {
          action: 'reject',
          autoKey: candidate.autoKey,
          reason: 'the feed stop was booked on the wrong unit',
        },
        {
          action: 'manual',
          sliceId: view.slices[0].sliceId,
          kind: 'availability',
          quantity: '150',
          missingEvent: true,
          // SME R11: a stop without an event cites its record
          evidenceType: 'log',
          evidenceRef: 'shift log',
          reasonCodeId: power,
        },
      ])
      .expect(200);
    await env.submit(await env.view()).expect(200);
    await env.approve(await env.view()).expect(200);
  });
  afterAll(() => env.stop());

  it('the plan loss tree shows the approved lines only', async () => {
    const window = `from=${encodeURIComponent(DAY1)}&to=${encodeURIComponent(NEXT_DAY)}`;
    const tree = (
      await env
        .get(
          `reports/loss-tree?unitIds=${env.world.unitA1}&${window}&groupBy=reason&metric=qty&ledger=plan`,
        )
        .expect(200)
    ).body as TreeBody;
    const amountOf = (key: string) =>
      tree.data.groups.find((g) => g.key === key)?.amount ?? null;
    expect(amountOf(power)).toBe('150');
    expect(amountOf(feed)).toBeNull();
  });

  it('a manual line is in the unit of its slice (Marun E2E: no "unit unknown" group)', async () => {
    const window = `from=${encodeURIComponent(DAY1)}&to=${encodeURIComponent(NEXT_DAY)}`;
    const tree = (
      await env
        .get(
          `reports/loss-tree?unitIds=${env.world.unitA1}&${window}&groupBy=reason&metric=qty&ledger=plan`,
        )
        .expect(200)
    ).body as TreeBody;
    // the world's products are in tonnes; the slice (and so the manual line) is too
    expect(tree.data.groups.find((g) => g.key === power)?.unit).toBe('t');
    expect(tree.data.totals.map((t) => t.unit)).toEqual(['t']);
  });

  it('QA PLA M3 re-test: the lines without an event list the manual line with its reason and evidence', async () => {
    const window = `from=${encodeURIComponent(DAY1)}&to=${encodeURIComponent(NEXT_DAY)}`;
    const body = (
      await env
        .get(
          `reports/lines-without-event?unitIds=${env.world.unitA1}&${window}&kinds=availability`,
        )
        .expect(200)
    ).body as {
      data: {
        total: number;
        items: Array<{
          origin: string;
          quantity: string;
          uom: string | null;
          reasonCodeId: string | null;
          reasonLabel: string | null;
          evidenceType: string | null;
          evidenceRef: string | null;
          periodId: string;
          planId: string | null;
        }>;
      };
    };
    expect(body.data.total).toBe(1);
    const [line] = body.data.items;
    expect(line).toMatchObject({
      origin: 'approved',
      quantity: '150',
      uom: 't',
      reasonCodeId: power,
      evidenceType: 'log',
      evidenceRef: 'shift log',
    });
    expect(line.reasonLabel).toMatch(/^POWER/);
    expect(line.periodId).toBeTruthy();
    expect(line.planId).toBeTruthy();
    const none = (
      await env
        .get(
          `reports/lines-without-event?unitIds=${env.world.unitA1}&${window}&kinds=performance`,
        )
        .expect(200)
    ).body as { data: { total: number; items: unknown[] } };
    expect(none.data).toMatchObject({ total: 0, items: [] });
  });

  it('the RCA approved impact of the rejected stop is empty', async () => {
    const impact = await approvedImpact(
      env.app.get(DataSource).manager,
      env.world.tenantA,
      { eventIds: [stopId] },
    );
    expect(impact.lines).toBe(0);
  });
});

/**
 * Revisions approved before approved lines were stored fall back to the approved run's lines: only the plan
 * ledger counts, because the capacity ledger is an alternative baseline of the same loss.
 */
describe('approved impact fallback counts the plan ledger only', () => {
  const env = new ReconciliationWorld();
  let stopId = '';

  beforeAll(async () => {
    await env.start();
    stopId = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1, {
      reasonCodeId: await env.reasonCode('FEED'),
    });
    await env.settle();
    const first = await env.view();
    const candidate = first.candidates.find((c) => c.causeEventId === stopId)!;
    await env
      .saveLines(first, [{ action: 'accept', autoKey: candidate.autoKey }])
      .expect(200);
    const accepted = await env.view();
    const residual = accepted.slices[0].residual;
    if (residual !== null && Number(residual) > 0)
      await env
        .saveLines(accepted, [
          { action: 'accept', autoKey: candidate.autoKey },
          {
            action: 'manual',
            sliceId: accepted.slices[0].sliceId,
            kind: 'availability',
            quantity: residual,
            missingEvent: true,
            evidenceType: 'log',
            evidenceRef: 'shift log',
            reasonCodeId: await env.reasonCode('POWER'),
          },
        ])
        .expect(200);
    await env.submit(await env.view()).expect(200);
    await env.approve(await env.view()).expect(200);
    // Recreate a revision approved before approved lines were stored: the immutability triggers are
    // suspended for this one test transaction only.
    await env.app.get(DataSource).transaction(async (tx) => {
      await tx.query(`SET LOCAL session_replication_role = replica`);
      for (const table of [
        'approved_loss_line_valuations',
        'approved_loss_lines',
      ])
        await tx.query(`DELETE FROM "${table}" WHERE "tenant_id" = $1`, [
          env.world.tenantA,
        ]);
    });
  });
  afterAll(() => env.stop());

  it('excludes capacity-ledger lines of the approved run', async () => {
    const manager = env.app.get(DataSource).manager;
    const [counts]: Array<{ plan: number; all: number }> = await manager.query(
      `SELECT count(*) FILTER (WHERE "ledger" = 'plan')::int AS "plan", count(*)::int AS "all"
         FROM "loss_lines" WHERE "tenant_id" = $1 AND "cause_event_id" = $2 AND "state" = 'active'`,
      [env.world.tenantA, stopId],
    );
    expect(counts.all).toBeGreaterThan(counts.plan);
    const impact = await approvedImpact(manager, env.world.tenantA, {
      eventIds: [stopId],
    });
    expect(impact.lines).toBe(counts.plan);
  });
});
