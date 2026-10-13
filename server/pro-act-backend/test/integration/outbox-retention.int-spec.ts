import { randomUUID } from 'crypto';
import { OutboxRetentionService } from '../../src/common/outbox/outbox-retention.service';
import { IntegrationHarness } from './harness';

const DAY_MS = 86_400_000;

/**
 * DB-07: published internal outbox messages and processed inbox keys older than the retention window are
 * deleted in batches; pending or failed messages, recent ones and the downstream domain events
 * (PeriodSubmitted / PeriodApproved / PeriodRestated, audit retention) are kept.
 */
describe('outbox and inbox retention (DB-07)', () => {
  const harness = new IntegrationHarness();
  const tenantId = randomUUID();
  const now = new Date('2027-06-01T00:00:00Z');
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);

  const outbox = (type: string, state: string, publishedDaysAgo: number) =>
    harness.dataSource.query<Array<{ id: string }>>(
      `INSERT INTO outbox (tenant_id, aggregate_type, aggregate_id, type, version, payload, state, attempts,
                           next_attempt_at, created_at, published_at)
       VALUES ($1, 'test', $2, $3, 1, '{}', $4, 0, $5, $5, $6) RETURNING id::text AS id`,
      [
        tenantId,
        randomUUID(),
        type,
        state,
        ago(publishedDaysAgo),
        state === 'published' ? ago(publishedDaysAgo) : null,
      ],
    );
  const inbox = (key: string, processedDaysAgo: number | null) =>
    harness.dataSource.query(
      `INSERT INTO inbox (delivery_key, tenant_id, scope, type, received_at, processed_at)
       VALUES ($1, $2, 'test', 'EventChanged', $3, $4)`,
      [
        key,
        tenantId,
        ago(processedDaysAgo ?? 200),
        processedDaysAgo === null ? null : ago(processedDaysAgo),
      ],
    );

  beforeAll(() => harness.start());
  afterAll(() => harness.stop());

  it('purges only old published internal messages and old processed inbox keys', async () => {
    const [oldInternal] = await outbox('EventChanged', 'published', 120);
    const [recent] = await outbox('EventChanged', 'published', 10);
    const [pending] = await outbox('EventChanged', 'pending', 120);
    const [failed] = await outbox('EventChanged', 'failed', 120);
    const [approved] = await outbox('PeriodApproved', 'published', 400);
    await inbox('old', 120);
    await inbox('recent', 10);
    await inbox('unprocessed', null);

    const result = await new OutboxRetentionService(harness.dataSource).purge(
      now,
      { retentionDays: 90, batchSize: 1 },
    );

    expect(result).toEqual({ outbox: 1, inbox: 1 });
    const kept = await harness.dataSource.query<Array<{ id: string }>>(
      `SELECT id::text AS id FROM outbox WHERE tenant_id = $1 ORDER BY id`,
      [tenantId],
    );
    expect(kept.map((row) => row.id)).toEqual(
      [recent, pending, failed, approved].map((row) => row.id),
    );
    expect(kept.map((row) => row.id)).not.toContain(oldInternal.id);
    const keys = await harness.dataSource.query<
      Array<{ delivery_key: string }>
    >(
      `SELECT delivery_key FROM inbox WHERE tenant_id = $1 ORDER BY delivery_key`,
      [tenantId],
    );
    expect(keys.map((row) => row.delivery_key)).toEqual([
      'recent',
      'unprocessed',
    ]);
  });
});
