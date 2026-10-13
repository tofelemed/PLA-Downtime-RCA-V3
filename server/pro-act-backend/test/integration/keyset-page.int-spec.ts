import { randomUUID } from 'crypto';
import { AuditLog } from '../../src/audit-log/audit-log.entity';
import { keysetPage } from '../../src/v2/common/keyset-page';
import { IntegrationHarness } from './harness';

/**
 * DB-02 / DB-06: keyset pages order and compare on the raw timestamp column, so the
 * `(tenant_id, timestamp, id)` index serves the page, and cursors carry microseconds, so rows that share
 * a millisecond are neither skipped nor repeated across pages.
 */
describe('keysetPage on the raw sort column (DB-02)', () => {
  const harness = new IntegrationHarness();
  const tenantId = randomUUID();
  const ids: string[] = [];

  beforeAll(async () => {
    await harness.start();
    for (let micro = 1; micro <= 5; micro += 1) {
      const id = randomUUID();
      ids.push(id);
      await harness.dataSource.query(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, tenant_id, timestamp)
         VALUES ($1, $2, 'UPDATE', 'Task', $3, $4, $5::timestamptz)`,
        [
          id,
          randomUUID(),
          randomUUID(),
          tenantId,
          `2027-03-01 10:00:00.12300${micro}+00`,
        ],
      );
    }
  });
  afterAll(() => harness.stop());

  const query = () =>
    harness.dataSource
      .getRepository(AuditLog)
      .createQueryBuilder('log')
      .where('log.tenantId = :tenantId', { tenantId });

  it('pages through rows of one millisecond without skips or repeats', async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 5; page += 1) {
      const result = await keysetPage(query(), {
        alias: 'log',
        property: 'timestamp',
        direction: 'DESC',
        cursor,
        limit: 2,
      });
      seen.push(...result.items.map((item) => item.id));
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }
    expect(seen).toEqual([...ids].reverse());
  });

  it('the page can be served by the (tenant_id, timestamp, id) index instead of a sort', async () => {
    const runner = harness.dataSource.createQueryRunner();
    try {
      await runner.query('SET enable_seqscan = off');
      await runner.query('SET enable_sort = off');
      const first = await keysetPage(query(), {
        alias: 'log',
        property: 'timestamp',
        direction: 'DESC',
        limit: 2,
      });
      const qb = query().setQueryRunner(runner);
      await keysetPage(qb, {
        alias: 'log',
        property: 'timestamp',
        direction: 'DESC',
        cursor: first.nextCursor ?? undefined,
        limit: 2,
      });
      const [sql, params] = qb.getQueryAndParameters();
      const plan = (await runner.query(`EXPLAIN ${sql}`, params)) as Array<{
        'QUERY PLAN': string;
      }>;
      const text = plan.map((row) => row['QUERY PLAN']).join('\n');
      expect(text).toContain('IDX_audit_logs_tenant_time');
      expect(text).not.toMatch(/^\s*(->\s+)?Sort\b/m);
    } finally {
      await runner.release();
    }
  });
});
