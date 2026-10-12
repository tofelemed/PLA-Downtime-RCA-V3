import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangeNotice } from '@/api/v2/queries/invalidation';
import { createInvalidationBatcher, mergeNotices, mergeWindows } from './invalidation-batcher';
import { getRealtimeStatus, setRealtimeStatus } from './realtime-status';

const notice = (entityType: string, entityId: string, from: string, to: string | null): ChangeNotice => ({
  tenantId: 't1',
  entityType,
  entityId,
  window: { from, to },
});

describe('realtime invalidation batching', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('merges windows; an unknown or open bound stays open', () => {
    expect(mergeWindows({ from: '2026-10-02', to: '2026-10-03' }, { from: '2026-10-01', to: '2026-10-05' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-05',
    });
    expect(mergeWindows({ from: '2026-10-02', to: null }, { from: '2026-10-01', to: '2026-10-05' })).toEqual({ from: '2026-10-01', to: null });
    expect(mergeWindows(null, { from: '2026-10-01', to: '2026-10-05' })).toBeNull();
  });

  it('merges notices per entity type and drops the id when several entities changed', () => {
    const merged = mergeNotices([
      notice('production_event', 'e1', '2026-10-01', '2026-10-02'),
      notice('production_event', 'e2', '2026-10-03', '2026-10-04'),
      notice('code', 'c1', '2026-10-01', '2026-10-02'),
    ]);
    expect(merged).toEqual([
      { tenantId: 't1', entityType: 'production_event', entityId: undefined, window: { from: '2026-10-01', to: '2026-10-04' } },
      { tenantId: 't1', entityType: 'code', entityId: 'c1', window: { from: '2026-10-01', to: '2026-10-02' } },
    ]);
  });

  it('a burst of notices is applied once, 500 ms after the last one', () => {
    const apply = vi.fn();
    const batcher = createInvalidationBatcher(apply, 500);
    for (let i = 0; i < 10; i += 1) {
      batcher.add(notice('production_event', `e${i}`, '2026-10-01', '2026-10-02'));
      vi.advanceTimersByTime(100);
    }
    expect(apply).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0][0]).toHaveLength(1);
  });

  it('dispose drops the pending batch', () => {
    const apply = vi.fn();
    const batcher = createInvalidationBatcher(apply, 500);
    batcher.add(notice('code', 'c1', '2026-10-01', null));
    batcher.dispose();
    vi.advanceTimersByTime(1000);
    expect(apply).not.toHaveBeenCalled();
  });

  it('connection status store', () => {
    setRealtimeStatus('live');
    expect(getRealtimeStatus()).toBe('live');
    setRealtimeStatus('idle');
    expect(getRealtimeStatus()).toBe('idle');
  });
});
