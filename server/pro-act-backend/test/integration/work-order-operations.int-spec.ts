import { randomUUID } from 'crypto';
import { A, B, HOUR } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';

interface ImportBody {
  total: number;
  created: number;
  updated: number;
  linked: number;
}

/**
 * SME D10 on real Postgres: CMMS operations of a pump failure are mapped onto its stop (linked by asset and
 * time), and the KPI run names the two measures — mean active repair time from the operations (diagnosis +
 * repair + test minus waiting for parts = 3 h) and mean time to restore production from the stop (6 h).
 * A caller scoped to one unit cannot replace another unit's operation.
 */
describe('CMMS work-order operations (SME D10)', () => {
  const env = new AccountingWorld();
  let periodA1 = '';
  const pump = randomUUID();
  const otherPump = randomUUID();

  const metric = async (name: string) => {
    const [row] = await env.rows<{
      value: string | null;
      cohort: { label?: string } | null;
    }>(
      `SELECT k."value"::text AS "value", k."cohort" FROM "kpi_results" k
         JOIN "accounting_revisions" ar ON ar."current_run_id" = k."run_id"
        WHERE ar."period_id" = $1 AND k."metric" = $2 AND k."scope"->>'level' = 'period'`,
      [periodA1, name],
    );
    return row;
  };

  const operation = (
    op: string,
    kind: string,
    from: number,
    to: number,
    extra: object = {},
  ) => ({
    workOrderId: 'WO-4000123',
    operationId: op,
    kind,
    startedAt: plus(A, from * HOUR),
    endedAt: plus(A, to * HOUR),
    assetId: pump,
    source: 'SAP PM',
    ...extra,
  });

  beforeAll(async () => {
    await env.start();
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    periodA1 = await env.periodId(env.world.unitA1, A);
    await env.outputEvent(env.world.unitA1, A, B, '300');
    await env.rows(
      `INSERT INTO "assets" ("id", "code", "name", "unit_id", "tenant_id", "asset_type") VALUES
         ($1, 'P-101', 'Process water pump', $3, $5, 'Pump'), ($2, 'P-201', 'Pump of unit 2', $4, $5, 'Pump')`,
      [pump, otherPump, env.world.unitA1, env.world.unitA2, env.world.tenantA],
    );
  });
  afterAll(() => env.stop());

  it('links the operations to the stop and reports active repair vs restore time', async () => {
    const stopId = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 6, {
      assetId: pump,
      scheduleClass: 'unplanned',
      failureMode: 'External leakage',
      failureSeverity: 'critical',
    });
    const imported = await env
      .post('work-order-operations/import', {
        operations: [
          operation('0010', 'diagnosis', 3, 4),
          operation('0020', 'repair', 4, 6, {
            waitingSeconds: 1800,
            waitingReason: 'Seal kit from store',
          }),
          operation('0030', 'test', 6, 6.5),
        ],
      })
      .expect(200);
    expect(imported.body as ImportBody).toEqual({
      total: 3,
      created: 3,
      updated: 0,
      linked: 3,
    });
    const [linked] = await env.rows<{ event_id: string }>(
      `SELECT DISTINCT "event_id" FROM "work_order_operations" WHERE "work_order_id" = 'WO-4000123'`,
    );
    expect(linked.event_id).toBe(stopId);
    const evidence = await env
      .get(`work-order-operations/repair-evidence?eventId=${stopId}`)
      .expect(200);
    expect(evidence.body).toMatchObject({
      eventId: stopId,
      operations: 3,
      activeOperations: 3,
      openOperations: 0,
      waitingSeconds: 1800,
      activeRepairSeconds: 3 * 3600,
      reason: null,
    });
    await env.settle();
    const mttr = await metric('mttr');
    expect(Number(mttr.value)).toBe(3 * 3600);
    expect(mttr.cohort?.label).toBe('mean active repair time');
    expect(Number((await metric('mean_downtime_to_restore')).value)).toBe(
      6 * 3600,
    );
  });

  it('refuses bad rows and an operation of a unit outside the caller scope', async () => {
    const bad = await env
      .post('work-order-operations/import', {
        operations: [operation('0040', 'repair', 5, 4)],
      })
      .expect(422);
    expect((bad.body as ApiError).code).toBe('WORK_ORDER_IMPORT_INVALID');
    const foreign = {
      ...operation('0010', 'repair', 2, 3),
      workOrderId: 'WO-UNIT2',
      assetId: otherPump,
    };
    await env
      .post('work-order-operations/import', { operations: [foreign] })
      .expect(200);
    const scoped = await env.unitUser(env.world.unitA1, 'reliability_engineer');
    await env
      .post(
        'work-order-operations/import',
        { operations: [{ ...foreign, assetId: pump, kind: 'other' }] },
        scoped,
      )
      .expect(422);
    const [stored] = await env.rows<{
      asset_id: string;
      operation_kind: string;
    }>(
      `SELECT "asset_id", "operation_kind" FROM "work_order_operations" WHERE "work_order_id" = 'WO-UNIT2'`,
    );
    expect(stored).toEqual({ asset_id: otherPump, operation_kind: 'repair' });
  });

  it('never links an operation to a stop of another unit', async () => {
    const otherStop = await env.lossEvent(env.world.unitA2, plus(A, HOUR), 2, {
      assetId: otherPump,
      scheduleClass: 'unplanned',
    });
    const mismatch = await env
      .post('work-order-operations/import', {
        operations: [
          {
            ...operation('0010', 'repair', 1.5, 2),
            workOrderId: 'WO-X1',
            eventId: otherStop,
          },
        ],
      })
      .expect(422);
    expect((mismatch.body as ApiError).code).toBe('WORK_ORDER_IMPORT_INVALID');
    const scoped = await env.unitUser(env.world.unitA1, 'reliability_engineer');
    const withoutAsset = {
      ...operation('0010', 'repair', 1.5, 2),
      assetId: undefined,
    };
    await env
      .post(
        'work-order-operations/import',
        {
          operations: [
            { ...withoutAsset, workOrderId: 'WO-X2', eventId: otherStop },
          ],
        },
        scoped,
      )
      .expect(422);
    const linked = await env.rows<{ n: number }>(
      `SELECT count(*)::int AS "n" FROM "work_order_operations" WHERE "event_id" = $1`,
      [otherStop],
    );
    expect(linked[0].n).toBe(0);
    const none = await env
      .get(`work-order-operations/repair-evidence?eventId=${otherStop}`)
      .expect(200);
    expect(none.body).toMatchObject({
      operations: 0,
      activeRepairSeconds: null,
      reason: 'no_operations',
    });
    await env
      .get(`work-order-operations/repair-evidence?eventId=${otherStop}`, scoped)
      .expect(404);
  });
});
