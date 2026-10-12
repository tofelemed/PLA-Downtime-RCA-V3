import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { V2ApiError } from '../errors';
import { shouldRetryQuery } from '@/app/query-client';
import { jobPollInterval, JOB_POLL_MS } from './ingestion-jobs';
import { sameEntityQuery, sameTenantQuery } from './placeholder';
import { stableWindow, v2Keys } from './query-keys';
import { ceilToMinute, DAY_MS, floorToMinute, rollingWindow, stabilizeWindowParams } from './time-window';

describe('minute-stable windows', () => {
  it('widens instants to whole minutes and leaves whole minutes and dates alone', () => {
    expect(floorToMinute('2026-10-12T06:30:41.123Z')).toBe('2026-10-12T06:30:00.000Z');
    expect(ceilToMinute('2026-10-12T06:30:41.123Z')).toBe('2026-10-12T06:31:00.000Z');
    expect(floorToMinute('2026-10-12T06:30:00Z')).toBe('2026-10-12T06:30:00Z');
    expect(ceilToMinute('2026-10-12T06:30:00.000Z')).toBe('2026-10-12T06:30:00.000Z');
    expect(floorToMinute('2026-10-12')).toBe('2026-10-12');
    expect(ceilToMinute(undefined)).toBeUndefined();
  });

  it('two rolling windows computed within one minute share a key', () => {
    const now = Date.parse('2026-10-12T06:30:05.000Z');
    const a = rollingWindow(7 * DAY_MS, now);
    const b = rollingWindow(7 * DAY_MS, now + 40_000);
    expect(a).toEqual(b);
    const key = (w: typeof a) => v2Keys.list('t1', 'reports', { window: { ...w, tz: 'Asia/Tehran' } });
    expect(key(a)).toEqual(key(b));
  });

  it('keys drop the display timezone (never sent to the server)', () => {
    expect(stableWindow({ from: '2026-10-12T00:00:00Z', to: '2026-10-13T00:00:00Z', tz: 'UTC' })).toEqual({
      from: '2026-10-12T00:00:00Z',
      to: '2026-10-13T00:00:00Z',
    });
    expect(stableWindow(null)).toBeNull();
  });

  it('request params get the same bounds as the key', () => {
    expect(stabilizeWindowParams({ from: '2026-10-12T06:30:41Z', to: '2026-10-13T06:30:41Z', limit: 20 })).toEqual({
      from: '2026-10-12T06:30:00.000Z',
      to: '2026-10-13T06:31:00.000Z',
      limit: 20,
    });
    const untouched = { limit: 20 };
    expect(stabilizeWindowParams(untouched)).toBe(untouched);
  });
});

describe('placeholder policies', () => {
  const list = { queryKey: ['v2', 't1', 'reports', 'list'] };
  const detail = { queryKey: ['v2', 't1', 'period-accounting', 'detail', 'p1', 'x'] };

  it('keeps previous data of the same tenant only', () => {
    expect(sameTenantQuery('t1', list)).toBe(true);
    expect(sameTenantQuery('t2', list)).toBe(false);
    expect(sameTenantQuery(null, list)).toBe(false);
    expect(sameTenantQuery('t1', undefined)).toBe(false);
  });

  it('entity reads keep previous data of the same record only', () => {
    expect(sameEntityQuery('t1', 'p1', detail)).toBe(true);
    expect(sameEntityQuery('t1', 'p2', detail)).toBe(false);
    expect(sameEntityQuery('t2', 'p1', detail)).toBe(false);
  });
});

describe('query defaults', () => {
  const envelope = (code: string, retryable = false) => ({ code, message: 'x', correlationId: null, retryable });

  it('never retries a 4xx (v1 or v2), retries 5xx and network failures twice', () => {
    expect(shouldRetryQuery(0, new V2ApiError(404, envelope('NOT_FOUND')))).toBe(false);
    expect(shouldRetryQuery(0, Object.assign(new Error('x'), { status: 403 }))).toBe(false);
    expect(shouldRetryQuery(0, new V2ApiError(429, envelope('RATE_LIMITED', true)))).toBe(true);
    expect(shouldRetryQuery(1, new V2ApiError(502, envelope('INTERNAL_ERROR')))).toBe(true);
    expect(shouldRetryQuery(2, new V2ApiError(502, envelope('INTERNAL_ERROR')))).toBe(false);
    expect(shouldRetryQuery(0, new TypeError('Failed to fetch'))).toBe(true);
  });

  it('createAppQueryClient keeps unused results for 10 minutes', async () => {
    const { createAppQueryClient, QUERY_GC_TIME_MS } = await import('@/app/query-client');
    const client: QueryClient = createAppQueryClient();
    expect(client.getDefaultOptions().queries?.gcTime).toBe(QUERY_GC_TIME_MS);
    expect(QUERY_GC_TIME_MS).toBe(600_000);
  });
});

describe('ingestion job polling', () => {
  it('polls only while a job is running or draining', () => {
    expect(jobPollInterval(['running', 'stopped'])).toBe(JOB_POLL_MS);
    expect(jobPollInterval(['draining'])).toBe(JOB_POLL_MS);
    expect(jobPollInterval(['stopped', 'failed', 'paused', 'created'])).toBe(false);
    expect(jobPollInterval([])).toBe(false);
    expect(jobPollInterval([undefined, null])).toBe(false);
  });
});
