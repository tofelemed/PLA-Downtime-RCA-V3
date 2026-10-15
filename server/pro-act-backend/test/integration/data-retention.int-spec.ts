import { randomUUID } from 'crypto';
import { DataRetentionService } from '../../src/common/retention/data-retention.service';
import {
  readRetentionPolicy,
  RetentionPolicy,
} from '../../src/common/retention/retention-policy';
import { IntegrationHarness } from './harness';
import { seedPlant } from './support/seed-plant';

const DAY_MS = 86_400_000;

/**
 * DB-07: retention of the audit request log, the append-only audit trail and old raw observation and
 * signal sample partitions. Off by default (every window null); when set, only what is older than the
 * window goes — in batches for the audit tables, by whole monthly partition for raw observations and
 * samples (never the current month) — and the audit trail stays append-only for everything else.
 */
describe('data retention (DB-07)', () => {
  const harness = new IntegrationHarness();
  const tenantId = randomUUID();
  const now = new Date('2027-06-01T00:00:00Z');
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const query = <T = unknown>(sql: string, params: unknown[] = []) =>
    harness.dataSource.query<T>(sql, params);
  const service = () => new DataRetentionService(harness.dataSource);
  const off: RetentionPolicy = {
    requestLogDays: null,
    auditTrailDays: null,
    rawDays: null,
    sampleDays: null,
    batchSize: 1,
  };

  const plant = (id: string) => seedPlant(harness.dataSource, id);
  const requestLog = (daysAgo: number, tenant = tenantId) =>
    query<Array<{ id: string }>>(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, tenant_id, timestamp)
       VALUES ($1, $2, 'UPDATE', 'Task', $3, $4, $5) RETURNING id::text AS id`,
      [randomUUID(), randomUUID(), randomUUID(), tenant, ago(daysAgo)],
    );
  const trail = (daysAgo: number, tenant = tenantId) =>
    query<Array<{ id: string }>>(
      `INSERT INTO audit_log (tenant_id, action, entity_type, entity_id, at)
       VALUES ($1, 'approve', 'period', $2, $3) RETURNING id::text AS id`,
      [tenant, randomUUID(), ago(daysAgo)],
    );
  /** The row ids of one tenant in a table, sorted as strings. */
  const ids = async (table: 'audit_logs' | 'audit_log', tenant: string) =>
    (
      await query<Array<{ id: string }>>(
        `SELECT id::text AS id FROM ${table} WHERE tenant_id = $1`,
        [tenant],
      )
    )
      .map((row) => row.id)
      .sort();
  const partitionsOf = async (
    parent: 'raw_observations' | 'measurement_samples',
  ) =>
    (
      await query<Array<{ name: string }>>(
        `SELECT c.relname AS name FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
          WHERE i.inhparent = $1::regclass ORDER BY 1`,
        [parent],
      )
    ).map((row) => row.name);
  const rawPartitions = () => partitionsOf('raw_observations');
  const samplePartitions = () => partitionsOf('measurement_samples');

  beforeAll(async () => {
    await harness.start();
    await plant(tenantId);
    for (const day of [400, 200, 100, 10, 1]) await requestLog(day);
    for (const day of [400, 100, 10]) await trail(day);
    for (const month of ['2027-01-15', '2027-02-15', '2027-03-15']) {
      await query(`SELECT raw_observations_ensure_partition($1::timestamptz)`, [
        `${month}T00:00:00Z`,
      ]);
    }
    // the June partition is the current month of `now`
    for (const month of [
      '2027-01-15',
      '2027-02-15',
      '2027-03-15',
      '2027-06-15',
    ]) {
      await query(
        `SELECT measurement_samples_ensure_partition($1::timestamptz)`,
        [`${month}T00:00:00Z`],
      );
    }
  });
  afterAll(() => harness.stop());

  it('is off by default: unset windows keep everything; a bad value is a configuration error', async () => {
    expect(readRetentionPolicy({})).toEqual({ ...off, batchSize: 1000 });
    expect(() => readRetentionPolicy({ RAW_RETENTION_DAYS: '0' })).toThrow(
      /RAW_RETENTION_DAYS/,
    );
    expect(() =>
      readRetentionPolicy({ AUDIT_TRAIL_RETENTION_DAYS: '30.5' }),
    ).toThrow(/whole number/);
    expect(() =>
      readRetentionPolicy({ SAMPLE_RETENTION_DAYS: '90 days' }),
    ).toThrow(/SAMPLE_RETENTION_DAYS/);
    const before = await rawPartitions();
    const samplesBefore = await samplePartitions();
    expect(await service().apply(now, off)).toEqual({
      requestLog: 0,
      auditTrail: 0,
      rawPartitions: [],
      samplePartitions: [],
    });
    expect(await rawPartitions()).toEqual(before);
    expect(await samplePartitions()).toEqual(samplesBefore);
  });

  it('deletes only rows and partitions older than the windows', async () => {
    const result = await service().apply(now, {
      requestLogDays: 90,
      auditTrailDays: 365,
      rawDays: 90,
      sampleDays: null,
      batchSize: 1,
    });
    // cutoff 2027-03-03: January and February (upper bound 1 Mar) go, March stays
    expect(result).toEqual({
      requestLog: 3,
      auditTrail: 1,
      rawPartitions: expect.arrayContaining([
        'raw_observations_y2027m01',
        'raw_observations_y2027m02',
      ]) as unknown,
      samplePartitions: [],
    });
    expect(await samplePartitions()).toContain('measurement_samples_y2027m01');
    const partitions = await rawPartitions();
    expect(partitions).toContain('raw_observations_y2027m03');
    expect(partitions).not.toContain('raw_observations_y2027m02');
    const [{ n: logs }] = await query<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM audit_logs WHERE tenant_id = $1`,
      [tenantId],
    );
    expect(logs).toBe(2);
    const [{ n: trails }] = await query<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM audit_log WHERE tenant_id = $1`,
      [tenantId],
    );
    expect(trails).toBe(2);
  });

  it('keeps the audit trail append-only outside a retention cutoff', async () => {
    const [recent] = await trail(5);
    await expect(
      query(`DELETE FROM audit_log WHERE id = $1`, [recent.id]),
    ).rejects.toThrow(/append-only/);
    await expect(
      query(`UPDATE audit_log SET reason = 'x' WHERE id = $1`, [recent.id]),
    ).rejects.toThrow(/append-only/);
    await expect(
      harness.dataSource.transaction(async (tx) => {
        await tx.query(
          `SELECT set_config('app.audit_retention_cutoff', $1, true)`,
          [ago(30).toISOString()],
        );
        await tx.query(`DELETE FROM audit_log WHERE id = $1`, [recent.id]);
      }),
    ).rejects.toThrow(/append-only/);
  });

  it('keeps both audit tables for the 30-day owner window: 31-day-old rows go, 29-day-old rows stay', async () => {
    const other = randomUUID();
    await plant(other);
    const [oldLog] = await requestLog(31, other);
    const [keptLog] = await requestLog(29, other);
    const [oldTrail] = await trail(31, other);
    const [keptTrail] = await trail(29, other);
    expect(await ids('audit_logs', other)).toEqual(
      [oldLog.id, keptLog.id].sort(),
    );
    expect(await ids('audit_log', other)).toEqual(
      [oldTrail.id, keptTrail.id].sort(),
    );
    const policy = readRetentionPolicy({
      AUDIT_REQUEST_LOG_RETENTION_DAYS: '30',
      AUDIT_TRAIL_RETENTION_DAYS: '30',
    });
    expect(policy).toEqual({
      requestLogDays: 30,
      auditTrailDays: 30,
      rawDays: null,
      sampleDays: null,
      batchSize: 1000,
    });

    const result = await service().apply(now, policy);

    expect(result.rawPartitions).toEqual([]);
    expect(result.samplePartitions).toEqual([]);
    expect(result.requestLog).toBeGreaterThanOrEqual(1);
    expect(result.auditTrail).toBeGreaterThanOrEqual(1);
    expect(await ids('audit_logs', other)).toEqual([keptLog.id]);
    expect(await ids('audit_log', other)).toEqual([keptTrail.id]);
    const [{ n: older }] = await query<Array<{ n: number }>>(
      `SELECT ((SELECT count(*) FROM audit_logs WHERE timestamp < $1) +
               (SELECT count(*) FROM audit_log WHERE at < $1))::int AS n`,
      [ago(30)],
    );
    expect(older).toBe(0);
  });

  it('drops whole sample partitions older than the 90-day owner window and never the current month', async () => {
    const policy = readRetentionPolicy({
      RAW_RETENTION_DAYS: '365',
      SAMPLE_RETENTION_DAYS: '90',
    });
    expect(policy).toMatchObject({ rawDays: 365, sampleDays: 90 });
    const raw = await rawPartitions();

    const result = await service().apply(now, policy);

    // cutoff 2027-03-03: January and February samples go, March and June stay
    expect(result.samplePartitions).toEqual(
      expect.arrayContaining([
        'measurement_samples_y2027m01',
        'measurement_samples_y2027m02',
      ]),
    );
    let samples = await samplePartitions();
    expect(samples).toEqual(
      expect.arrayContaining([
        'measurement_samples_y2027m03',
        'measurement_samples_y2027m06',
      ]),
    );
    expect(samples).not.toContain('measurement_samples_y2027m02');
    // the 1-year raw window (cutoff 2026-06-01) keeps the 2027 raw partitions
    expect(result.rawPartitions).toEqual([]);
    expect(await rawPartitions()).toEqual(raw);

    // even a 1-day window keeps the month that holds `now`
    const tight = await service().apply(now, { ...off, sampleDays: 1 });
    expect(tight.samplePartitions).toContain('measurement_samples_y2027m03');
    samples = await samplePartitions();
    expect(samples).toContain('measurement_samples_y2027m06');
    expect(samples).not.toContain('measurement_samples_y2027m03');
  });
});
