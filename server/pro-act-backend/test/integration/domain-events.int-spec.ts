import { domainEventViolations } from '../../src/common/domain-events/domain-event-validator';
import { InProcessEventBus } from '../../src/common/outbox/in-process-event-bus';
import { InboxService } from '../../src/common/outbox/inbox.service';
import { OutboxRelayService } from '../../src/common/outbox/outbox-relay.service';
import { PublishedMessage } from '../../src/common/outbox/outbox-transport';
import { A, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ExportWorld } from './support/export-world';

interface OutboxRow {
  id: string;
  type: string;
  state: string;
  attempts: number;
  last_error: string | null;
  payload: Record<string, unknown>;
}

interface Receipt {
  revisionId: string;
  state: string;
  attempts: number;
  domainEventId: string | null;
  lastErrorCode: string | null;
}

/**
 * Plan 2.9 domain messages and delivery (API05, §15.4, WF03, T39 delivery half): PeriodSubmitted /
 * PeriodApproved / PeriodRestated carry the versioned envelope and validate against their contracts; the
 * relay never publishes a payload that violates its contract (dead letter SCHEMA_INVALID); a consumer
 * deduplicating on the outbox id has one effect per message; a delivery that keeps failing ends `dead`
 * without touching the approval, and the delivery reconciliation shows it; change proposals list the
 * completed exports of the approved revision.
 */
describe('domain messages and downstream delivery (plan 2.9)', () => {
  const env = new ExportWorld();
  let reason = '';
  const outbox = (periodId: string, type: string) =>
    env.rows<OutboxRow>(
      `SELECT id::text, type, state, attempts, last_error, payload FROM outbox
        WHERE aggregate_id = $1 AND type = $2 ORDER BY id`,
      [periodId, type],
    );
  const receipts = async (): Promise<Receipt[]> => {
    const response = await env
      .get(
        'deliveries/reconciliation?from=2020-01-01T00:00:00Z&to=2100-01-01T00:00:00Z',
      )
      .expect(200);
    return (response.body as { items: Receipt[] }).items;
  };

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
  });
  afterAll(() => env.stop());

  it('PeriodSubmitted and PeriodApproved follow their contracts and carry the approved totals, unvalued', async () => {
    const approved = await env.approvePeriod(env.periodA1, reason);
    const [submitted] = await outbox(env.periodA1, 'PeriodSubmitted');
    expect(
      domainEventViolations('PeriodSubmitted', submitted.payload),
    ).toBeNull();
    const [message] = await outbox(env.periodA1, 'PeriodApproved');
    expect(domainEventViolations('PeriodApproved', message.payload)).toBeNull();
    expect(message.payload).toMatchObject({
      schemaVersion: 1,
      tenantId: env.world.tenantA,
      entityType: 'production_period',
      entityId: env.periodA1,
      entityRevision: 1,
      revisionId: approved.revision.id,
      priorRevisionId: null,
      calculationRunId: approved.revision.currentRunId,
      unitId: env.world.unitA1,
      valuation: { status: 'unvalued', currency: null },
    });
    expect(message.payload.correlationId).toEqual(expect.any(String));
    expect(message.payload.products).toEqual([
      expect.objectContaining({
        productId: env.products.p1,
        uom: 't',
        target: '1000',
        actual: '850',
        gap: '150',
        attributed: '150',
        residual: '0',
      }),
    ]);
    expect(await outbox(env.periodA1, 'PeriodRestated')).toEqual([]);
  });

  it('a consumer deduplicating on the outbox id has exactly one effect per message', async () => {
    const effects: string[] = [];
    const delivered: PublishedMessage[] = [];
    const inbox = env.app.get(InboxService);
    const bus = env.app.get(InProcessEventBus);
    const consume = async (message: PublishedMessage) => {
      delivered.push(message);
      await inbox.runOnce(
        {
          key: `downstream-test:${message.id}`,
          tenantId: message.tenantId,
          consumer: 'downstream-test',
          type: message.type,
        },
        () => {
          effects.push(String(message.payload.domainEventId));
          return Promise.resolve();
        },
      );
    };
    const unsubscribe = bus.subscribe('PeriodApproved', consume);
    try {
      await env.relay();
      expect(effects).toHaveLength(1);
      await bus.dispatch(delivered[0]);
      expect(effects).toHaveLength(1);
      const [receipt] = await receipts();
      expect(receipt).toMatchObject({
        state: 'delivered',
        domainEventId: effects[0],
        lastErrorCode: null,
      });
    } finally {
      unsubscribe();
    }
  });

  it('a payload that violates its contract is never published: dead letter SCHEMA_INVALID at once', async () => {
    const seen: string[] = [];
    const unsubscribe = env.app
      .get(InProcessEventBus)
      .subscribe('PeriodApproved', (m) => {
        seen.push(m.id);
        return Promise.resolve();
      });
    try {
      await env.rows(
        `INSERT INTO outbox (tenant_id, aggregate_type, aggregate_id, type, version, payload)
         VALUES ($1, 'production_period', $2, 'PeriodApproved', 1, '{"periodId": "x"}')`,
        [env.world.tenantA, env.periodC1],
      );
      await env.app.get(OutboxRelayService).relayBatch();
      const [row] = await outbox(env.periodC1, 'PeriodApproved');
      expect(row).toMatchObject({ state: 'failed', attempts: 1 });
      expect(row.last_error).toMatch(/^SCHEMA_INVALID/);
      expect(seen).toEqual([]);
    } finally {
      unsubscribe();
    }
  });

  it('a delivery that keeps failing retries with backoff, ends dead and never undoes the approval', async () => {
    process.env.OUTBOX_MAX_ATTEMPTS = '2';
    const unsubscribe = env.app
      .get(InProcessEventBus)
      .subscribe('PeriodApproved', () =>
        Promise.reject(new Error('downstream unavailable')),
      );
    try {
      const approved = await env.approvePeriod(env.periodB1, reason);
      await env.relay();
      const [first] = await outbox(env.periodB1, 'PeriodApproved');
      expect(first).toMatchObject({ state: 'pending', attempts: 1 });
      const due = await env.rows<{ due: boolean }>(
        `SELECT next_attempt_at > now() AS due FROM outbox WHERE id = $1`,
        [first.id],
      );
      expect(due[0].due).toBe(true);
      await env.rows(
        `UPDATE outbox SET next_attempt_at = now() WHERE id = $1`,
        [first.id],
      );
      await env.relay();
      const [dead] = await outbox(env.periodB1, 'PeriodApproved');
      expect(dead).toMatchObject({ state: 'failed', attempts: 2 });
      const view = await env.view(env.periodB1);
      expect(view.revision).toMatchObject({
        id: approved.revision.id,
        lifecycle: 'approved',
      });
      const receipt = (await receipts()).find(
        (r) => r.revisionId === approved.revision.id,
      );
      expect(receipt).toMatchObject({
        state: 'dead',
        attempts: 2,
        lastErrorCode: 'PUBLISH_FAILED',
      });
    } finally {
      unsubscribe();
      delete process.env.OUTBOX_MAX_ATTEMPTS;
    }
  });

  it('a re-approval emits PeriodRestated naming the prior revision', async () => {
    const before = await env.view(env.periodA1);
    await env
      .post(`production-periods/${env.periodA1}/revise`, {
        approvedRevision: 1,
        reason: 'recheck',
      })
      .expect(201);
    await env.settle();
    await env.approvePeriod(env.periodA1, reason);
    const [restated] = await outbox(env.periodA1, 'PeriodRestated');
    expect(
      domainEventViolations('PeriodRestated', restated.payload),
    ).toBeNull();
    expect(restated.payload).toMatchObject({
      entityRevision: 2,
      revision: 2,
      priorRevisionId: before.revision.id,
    });
  });

  it('a change proposal lists the completed exports of the approved revision', async () => {
    const jobId = await env.exportDay();
    await env.runExports();
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1);
    await env.settle();
    const listed = await env
      .get(`production-periods/${env.periodA1}/change-proposals`)
      .expect(200);
    const [proposal] = (
      listed.body as {
        items: Array<{ affectedReports: Array<{ exportId: string }> }>;
      }
    ).items;
    expect(proposal.affectedReports.map((r) => r.exportId)).toContain(jobId);
  });
});
