import { Logger } from '@nestjs/common';
import { ShutdownCoordinator } from '../scheduling/shutdown-coordinator.service';
import { DataRetentionJob } from './data-retention.job';
import {
  DataRetentionService,
  RetentionResult,
} from './data-retention.service';

const ENV_KEYS = [
  'AUDIT_REQUEST_LOG_RETENTION_DAYS',
  'AUDIT_TRAIL_RETENTION_DAYS',
  'RAW_RETENTION_DAYS',
  'SAMPLE_RETENTION_DAYS',
  'RETENTION_BATCH',
] as const;

describe('DataRetentionJob', () => {
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};
  let log: jest.SpyInstance;
  let apply: jest.Mock<Promise<RetentionResult>>;

  const job = () =>
    new DataRetentionJob(
      { apply } as unknown as DataRetentionService,
      new ShutdownCoordinator(),
    );

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    apply = jest.fn<Promise<RetentionResult>, unknown[]>().mockResolvedValue({
      requestLog: 12,
      auditTrail: 3,
      rawPartitions: [],
      samplePartitions: [],
    });
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    jest.restoreAllMocks();
  });

  it('logs the 30-day audit windows and how many rows each table lost', async () => {
    process.env.AUDIT_REQUEST_LOG_RETENTION_DAYS = '30';
    process.env.AUDIT_TRAIL_RETENTION_DAYS = '30';

    await job().run();

    expect(apply).toHaveBeenCalledWith(expect.any(Date), {
      requestLogDays: 30,
      auditTrailDays: 30,
      rawDays: null,
      sampleDays: null,
      batchSize: 1000,
    });
    expect(log).toHaveBeenCalledWith(
      'Retention (request log 30 d, audit trail 30 d, raw keep, samples keep) deleted 12 request-log ' +
        'and 3 audit-trail row(s); dropped raw partitions: none; dropped sample partitions: none',
    );
  });

  it('applies the 1-year raw and 90-day sample windows and logs the dropped partitions', async () => {
    process.env.RAW_RETENTION_DAYS = '365';
    process.env.SAMPLE_RETENTION_DAYS = '90';
    apply.mockResolvedValue({
      requestLog: 0,
      auditTrail: 0,
      rawPartitions: ['raw_observations_y2026m01'],
      samplePartitions: [
        'measurement_samples_y2026m06',
        'measurement_samples_y2026m07',
      ],
    });

    await job().run();

    expect(apply).toHaveBeenCalledWith(expect.any(Date), {
      requestLogDays: null,
      auditTrailDays: null,
      rawDays: 365,
      sampleDays: 90,
      batchSize: 1000,
    });
    expect(log).toHaveBeenCalledWith(
      'Retention (request log keep, audit trail keep, raw 365 d, samples 90 d) deleted 0 request-log ' +
        'and 0 audit-trail row(s); dropped raw partitions: raw_observations_y2026m01; dropped sample ' +
        'partitions: measurement_samples_y2026m06, measurement_samples_y2026m07',
    );
  });

  it('logs an invalid SAMPLE_RETENTION_DAYS and deletes nothing', async () => {
    process.env.SAMPLE_RETENTION_DAYS = '90d';
    const error = jest.spyOn(Logger.prototype, 'error');

    await job().run();

    expect(apply).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      'Data retention failed',
      expect.stringContaining('SAMPLE_RETENTION_DAYS must be a whole number'),
    );
  });

  it('does nothing while every window is unset', async () => {
    await job().run();

    expect(apply).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
