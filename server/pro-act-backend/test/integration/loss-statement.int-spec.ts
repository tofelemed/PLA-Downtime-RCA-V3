import { randomUUID } from 'crypto';
import { A, NEXT_DAY } from './support/actuals-world';
import { ReconciliationWorld } from './support/reconciliation-world';

/** Declared day policy of unit A2: the OT figures, accounted per day (Task 13 mixed window). */
const DECLARED_DAY = {
  grain: 'day',
  dayStart: '06:00',
  lossBasis: 'declared',
  targetSource: 'declared',
  accountingUnitId: null,
  stopsCrossCheck: false,
  identityTolerance: 0,
};

interface StatementBody {
  planned: string | null;
  actual: string | null;
  shortfall: string | null;
  availability: string;
  performance: string;
  quality: string;
  transitionExcess: string;
  unaccountedClassified: string;
  grossAttributed: string;
  recovery: string;
  recoveryVerified: boolean;
  netAccounted: string;
  toleranceAdjustment: string;
  unaccounted: string | null;
  uom: string | null;
  revisionState: string;
}

interface RowBody {
  periodId: string;
  unitId: string;
  localDate: string;
  shiftName: string | null;
  grain: string;
  basis: string | null;
  revisionState: string | null;
  statement: StatementBody | null;
}

interface ReportBody {
  data: {
    total: StatementBody | null;
    incomplete: number;
    items: RowBody[];
    nextCursor: string | null;
  };
  isProvisional: boolean;
  dataQuality: { notes?: string[] };
}

const OWNER_STATEMENT = {
  planned: '240',
  actual: '208',
  shortfall: '32',
  availability: '23',
  performance: '11',
  quality: '6',
  transitionExcess: '0',
  unaccountedClassified: '0',
  grossAttributed: '40',
  recovery: '8',
  netAccounted: '32',
  toleranceAdjustment: '0',
  unaccounted: '0',
};

/** shortfall = net accounted + tolerance adjustment + unaccounted; net = gross − recovery. */
function expectIdentity(s: StatementBody) {
  const n = (v: string | null) => Number(v ?? 'NaN');
  expect(n(s.shortfall)).toBeCloseTo(
    n(s.netAccounted) + n(s.toleranceAdjustment) + n(s.unaccounted),
    6,
  );
  expect(n(s.netAccounted)).toBeCloseTo(
    n(s.grossAttributed) - n(s.recovery),
    6,
  );
}

/**
 * Task 13 on real Postgres: `GET /v2/reports/loss-statement` over a mixed window — unit A1 accounted by
 * computed shifts, unit A2 a declared day split 23 + 11 + 6 − 8 = 32 — the approved-only filter, the
 * recovery verification marker, the day view and the period view statements. Test data only.
 */
describe('loss accounting statement (Task 13)', () => {
  const env = new ReconciliationWorld();
  let dayPeriod = '';
  let lossEvent = '';
  let reason = '';

  const report = async (query: string): Promise<ReportBody> =>
    (await env.get(`reports/loss-statement?${query}`).expect(200))
      .body as ReportBody;
  const window = () =>
    `from=${encodeURIComponent(A)}&to=${encodeURIComponent(NEXT_DAY)}` +
    `&unitIds=${env.world.unitA1}&unitIds=${env.world.unitA2}`;

  const component = async (code: string, oee: string | null) => {
    const id = await env.reasonCode(code);
    if (oee)
      await env.rows(
        `UPDATE reason_codes SET default_oee_component = $2 WHERE id = $1`,
        [id, oee],
      );
    return id;
  };

  const declaredDay = async () => {
    const unit = env.world.unitA2;
    await env.approvedPlan(unit);
    await env.dailyCalendar(unit);
    await env.rows(
      `INSERT INTO accounting_policies (tenant_id, row_version, policy_kind, unit_id, scope_key, version, body,
              effective_from, approved_at)
       VALUES ($1, 1, 'loss_accounting', $2::uuid, $2, 1, $3::jsonb, '2026-01-01T00:00:00Z', now())`,
      [env.world.tenantA, unit, JSON.stringify(DECLARED_DAY)],
    );
    await env.materialize([unit], A, NEXT_DAY);
    dayPeriod = await env.periodId(unit, A);
  };

  const codeRecoverySplit = async () => {
    const [avail, perf, qual, recov] = [
      await component('TRIP', 'availability'),
      await component('SLOW', 'performance'),
      await component('OFFSPEC', 'quality'),
      await component('CATCHUP', null),
    ];
    const created = await env
      .post('production-events', {
        unitId: env.world.unitA2,
        startTime: A,
        endTime: NEXT_DAY,
        physicalType: 'production_loss',
        declaredFigures: {
          planned: 240,
          actual: 208,
          shortfall: 32,
          uom: 't',
          sourceStatus: 'CONFIRMED',
        },
      })
      .expect(201);
    lossEvent = (created.body as { id: string }).id;
    const event = await env.get(`production-events/${lossEvent}`).expect(200);
    const weights = [
      { reasonCodeId: avail, quantity: '23' },
      { reasonCodeId: perf, quantity: '11' },
      { reasonCodeId: qual, quantity: '6' },
      { reasonCodeId: recov, quantity: '8', recovery: true },
    ];
    await env
      .patch(
        `production-events/${lossEvent}`,
        { reasonCodeId: avail, reasonWeights: weights },
        `"${(event.body as { rowVersion: number }).rowVersion}"`,
      )
      .expect(200);
    await env.settle();
    await env.recompute(dayPeriod);
  };

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
    await declaredDay();
    await codeRecoverySplit();
  });
  afterAll(() => env.stop());

  it('states the declared day exactly as the owner table: 240 / 208 / 32 / 23 / 11 / 6 / 40 / −8 / 32 / 0', async () => {
    const body = await report(window());
    const day = body.data.items.find((row) => row.periodId === dayPeriod);
    expect(day).toMatchObject({
      grain: 'day',
      basis: 'declared',
      revisionState: 'provisional',
    });
    expect(day?.statement).toMatchObject({
      ...OWNER_STATEMENT,
      recoveryVerified: false,
      revisionState: 'provisional',
    });
  });

  it('lists the computed shifts and the declared day in (local date, start, id) order with one total', async () => {
    const body = await report(window());
    const shifts = body.data.items.filter((r) => r.unitId === env.world.unitA1);
    expect(shifts).toHaveLength(3);
    expect(
      shifts.every((r) => r.grain === 'shift' && r.basis === 'computed'),
    ).toBe(true);
    expect(body.data.items).toHaveLength(4);
    for (const row of body.data.items) {
      if (row.statement && row.statement.shortfall !== null)
        expectIdentity(row.statement);
    }
    expect(body.isProvisional).toBe(true);
    if (body.data.total) {
      expectIdentity(body.data.total);
      expect(Number(body.data.total.recovery)).toBe(8);
    } else {
      expect(body.dataQuality.notes).toContain('uom_mixed');
    }
  });

  it('pages by keyset without losing or repeating a row', async () => {
    const first = await report(`${window()}&limit=3`);
    expect(first.data.items).toHaveLength(3);
    expect(first.data.nextCursor).not.toBeNull();
    const second = await report(
      `${window()}&limit=3&cursor=${first.data.nextCursor ?? ''}`,
    );
    expect(second.data.items).toHaveLength(1);
    expect(second.data.nextCursor).toBeNull();
    const ids = [...first.data.items, ...second.data.items].map(
      (r) => r.periodId,
    );
    expect(new Set(ids).size).toBe(4);
    await env
      .get(`reports/loss-statement?${window()}&cursor=not-a-cursor`)
      .expect(400);
  });

  it('approved only: periods without an approved revision are left out and counted as incomplete', async () => {
    const view = await env.view(env.periodA1);
    const lines = env.rejectAllPlus(view, view.slices[0].gap as string, reason);
    await env.saveLines(view, lines).expect(200);
    await env.submit(await env.view()).expect(200);
    await env.approve(await env.view()).expect(200);

    const body = await report(`${window()}&revision=approved`);
    expect(body.data.incomplete).toBe(3);
    expect(body.dataQuality.notes).toContain('incomplete_periods');
    const approved = body.data.items.find((r) => r.periodId === env.periodA1);
    expect(approved).toMatchObject({ revisionState: 'approved' });
    expect(approved?.statement).toMatchObject({
      revisionState: 'approved',
      unaccounted: '0',
    });
    const left = body.data.items.filter((r) => r.periodId !== env.periodA1);
    expect(
      left.every((r) => r.statement === null && r.revisionState === null),
    ).toBe(true);
    expect(body.data.total).toMatchObject({
      revisionState: 'approved',
      shortfall: approved?.statement?.shortfall,
    });
  });

  it('the recovery counts as verified once a supervisor verified the event coding', async () => {
    await env.rows(
      `UPDATE production_events SET verified_by = $2, verified_at = now() WHERE id = $1`,
      [lossEvent, env.world.tenantA],
    );
    const body = await report(window());
    const day = body.data.items.find((row) => row.periodId === dayPeriod);
    expect(day?.statement?.recoveryVerified).toBe(true);
  });

  it('the day view and the period view carry the same statement', async () => {
    const dayView = await env
      .get(`production-days/${env.world.unitA2}/2027-03-01`)
      .expect(200);
    const accounting = (
      dayView.body as {
        accounting: { statement: StatementBody; incomplete: number };
      }
    ).accounting;
    expect(accounting.incomplete).toBe(0);
    expect(accounting.statement).toMatchObject(OWNER_STATEMENT);
    const period = (await env.view(dayPeriod)) as unknown as {
      statement: StatementBody;
    };
    expect(period.statement).toMatchObject(OWNER_STATEMENT);
  });

  it('refuses a unit outside the tenant and an unknown revision', async () => {
    await env
      .get(`reports/loss-statement?${window()}&revision=draft`)
      .expect(422);
    const foreign = await env
      .get(
        `reports/loss-statement?from=${encodeURIComponent(A)}&to=${encodeURIComponent(NEXT_DAY)}&unitIds=${randomUUID()}`,
      )
      .expect(422);
    expect((foreign.body as { code: string }).code).toBe('INVALID_REFERENCE');
  });
});
