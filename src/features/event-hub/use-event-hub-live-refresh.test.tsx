import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { realtimeBus } from '@/realtime/realtime-bus';
import type { RealtimeNotice } from '@/realtime/realtime-types';

const flag = vi.hoisted(() => ({ enabled: false, loading: false }));
const v1 = vi.hoisted(() => {
  const listeners = new Map<string, () => void>();
  return {
    listeners,
    socket: {
      connect: vi.fn(),
      on: vi.fn((name: string, listener: () => void) => {
        listeners.set(name, listener);
        return () => listeners.delete(name);
      }),
    },
  };
});

vi.mock('@/api/v2/queries/feature-flags', () => ({ useFlag: () => flag }));
vi.mock('@/services/api/productionEventsWebSocket', () => ({ productionEventsWebSocket: v1.socket }));

const { useEventHubLiveRefresh, LIVE_REFRESH_DEBOUNCE_MS } = await import('./use-event-hub-live-refresh');
const { FlaggedRoute } = await import('@/features/v2-foundation/flagged-route');

const notice = (entityType: string): RealtimeNotice => ({
  domainEventId: `id-${entityType}`,
  room: 'tenant:t',
  seq: '1',
  prevSeq: null,
  type: 'EventChanged',
  entityType,
  entityId: 'e',
  revision: 1,
  occurredAt: '2026-10-09T00:00:00Z',
  scope: { tenantId: 't', unitIds: [] },
  window: null,
});

describe('Event Hub live refresh behind v2.eventHub (plan 3.1 step 3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    v1.listeners.clear();
    v1.socket.connect.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('flag off: the v1 broadcast triggers one debounced refresh per burst', () => {
    flag.enabled = false;
    const refresh = vi.fn();
    renderHook(() => useEventHubLiveRefresh(true, refresh, 'u|t'));
    expect(v1.socket.connect).toHaveBeenCalled();
    v1.listeners.get('productionEventUpdated')?.();
    v1.listeners.get('productionEventCreated')?.();
    act(() => vi.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('flag on: scoped production-event notices and resyncs refresh; other notices do not', () => {
    flag.enabled = true;
    const refresh = vi.fn();
    renderHook(() => useEventHubLiveRefresh(true, refresh, 'u|t'));
    expect(v1.socket.connect).not.toHaveBeenCalled();
    realtimeBus.publish({ kind: 'notice', notice: notice('production_plan') });
    act(() => vi.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS));
    expect(refresh).not.toHaveBeenCalled();
    realtimeBus.publish({ kind: 'notice', notice: notice('production_event') });
    act(() => vi.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS));
    realtimeBus.publish({ kind: 'resync', rooms: ['tenant:t'] });
    act(() => vi.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('FlaggedRoute renders v1 or v2 from the server flag', () => {
    flag.enabled = false;
    const { rerender } = render(<FlaggedRoute flag="v2.eventHub" v1={<p>v1 screen</p>} v2={<p>v2 screen</p>} />);
    expect(screen.getByText('v1 screen')).toBeInTheDocument();
    flag.enabled = true;
    rerender(<FlaggedRoute flag="v2.eventHub" v1={<p>v1 screen</p>} v2={<p>v2 screen</p>} />);
    expect(screen.getByText('v2 screen')).toBeInTheDocument();
  });
});
