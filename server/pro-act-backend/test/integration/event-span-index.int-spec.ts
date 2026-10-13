import { randomUUID } from 'crypto';
import { EVENTS_SQL } from '../../src/accounting/accounting-inputs.loader';
import { TOUCHING_SQL } from '../../src/accounting/kpi-inputs.loader';
import { OUTPUT_EVENTS_SQL } from '../../src/periods/actuals-inputs.loader';
import { IntegrationHarness } from './harness';

/**
 * DB-01: the period loaders' event lookups (accounting events, KPI occurrences, output events) can be
 * served by the GiST span index, so a recompute reads the events touching its window rather than every
 * earlier event of the unit.
 */
describe('period loaders use the event span index (DB-01)', () => {
  const harness = new IntegrationHarness();
  const window = [
    randomUUID(),
    randomUUID(),
    new Date('2027-03-01T02:30:00Z'),
    new Date('2027-03-01T10:30:00Z'),
  ];

  beforeAll(() => harness.start());
  afterAll(() => harness.stop());

  it.each([
    ['accounting events', EVENTS_SQL],
    ['KPI occurrences', TOUCHING_SQL],
    ['output events', OUTPUT_EVENTS_SQL],
  ])('%s', async (_name, sql) => {
    const runner = harness.dataSource.createQueryRunner();
    try {
      await runner.query('SET enable_seqscan = off');
      await runner.query('SET enable_indexscan = off');
      const plan = (await runner.query(`EXPLAIN ${sql}`, window)) as Array<{
        'QUERY PLAN': string;
      }>;
      const text = plan.map((row) => row['QUERY PLAN']).join(' | ');
      expect(text).toContain('IDX_production_events_unit_span');
      expect(text).toMatch(/Index Cond: .*&&/);
    } finally {
      await runner.release();
    }
  });
});
