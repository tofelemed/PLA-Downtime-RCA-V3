import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { v2Keys } from '@/api/v2/queries/query-keys';
import type { RealtimeNotice, SocketFactory, SubscribeAck } from './realtime-types';
import { ScopedRealtimeClient } from './scoped-socket';
import { useScopedRealtime } from './use-scoped-realtime';

const ROOM = 'tenant:tenant-a';

const notice = (seq: string, prevSeq: string | null, extra: Partial<RealtimeNotice> = {}): RealtimeNotice => ({
  domainEventId: `outbox:${seq}`,
  room: ROOM,
  seq,
  prevSeq,
  type: 'EventChanged',
  entityType: 'production_event',
  entityId: 'e1',
  revision: 2,
  occurredAt: '2026-10-09T06:00:00Z',
  scope: { tenantId: 'tenant-a', unitIds: ['u1'] },
  window: { from: '2026-10-09T05:00:00Z', to: '2026-10-09T06:00:00Z' },
  ...extra,
});

/** A fake socket.io connection driven by the test. */
class FakeSocket {
  readonly handlers = new Map<string, (...args: unknown[]) => void>();
  readonly emitted: Array<{ event: string; payload: unknown; ack?: (response: unknown) => void }> = [];
  auth: unknown = null;
  on(event: string, listener: (...args: unknown[]) => void) {
    this.handlers.set(event, listener);
    return this;
  }
  emit(event: string, payload: unknown, ack?: (response: unknown) => void) {
    this.emitted.push({ event, payload, ack });
    return this;
  }
  disconnect() {
    return this;
  }
  fire(event: string, payload?: unknown) {
    this.handlers.get(event)?.(payload);
  }
  lastSubscribe() {
    return [...this.emitted].reverse().find((entry) => entry.event === 'realtime.subscribe');
  }
}

const tab = (tenantId = 'tenant-a') => {
  const socket = new FakeSocket();
  const factory: SocketFactory = (_url, auth) => {
    auth((data) => {
      socket.auth = data;
    });
    return socket;
  };
  const handlers = { onNotice: vi.fn(), onResync: vi.fn() };
  const client = new ScopedRealtimeClient(factory, handlers, () => ({ token: 'jwt', tenantId }));
  client.start('http://api/realtime');
  return { socket, handlers, client };
};

const ack = (headSeq: string | null, resync: string[] = []): SubscribeAck => ({ rooms: [{ room: ROOM, headSeq }], resync, replayed: 0 });

describe('scoped realtime client — T23 (plan 3.1)', () => {
  it('authenticates in the handshake auth payload, not the URL', () => {
    const { socket } = tab();
    expect(socket.auth).toEqual({ token: 'jwt', tenantId: 'tenant-a' });
  });

  it('two tabs of a tenant each handle a change once; duplicates are dropped; tenant B data is ignored', () => {
    const one = tab();
    const two = tab();
    for (const { socket } of [one, two]) {
      socket.fire('connect');
      socket.lastSubscribe()?.ack?.(ack('10'));
      socket.fire('realtime.message', notice('11', '10'));
      socket.fire('realtime.message', notice('11', '10'));
      socket.fire('realtime.message', notice('12', '11', { scope: { tenantId: 'tenant-b', unitIds: [] } }));
    }
    for (const { handlers } of [one, two]) {
      expect(handlers.onNotice).toHaveBeenCalledTimes(1);
      expect(handlers.onResync).not.toHaveBeenCalled();
    }
  });

  it('a missed seq triggers a snapshot resync instead of applying partial data', () => {
    const { socket, handlers } = tab();
    socket.fire('connect');
    socket.lastSubscribe()?.ack?.(ack('10'));
    socket.fire('realtime.message', notice('11', '10'));
    socket.fire('realtime.message', notice('14', '12'));
    expect(handlers.onResync).toHaveBeenCalledWith([ROOM], 'gap');
  });

  it('reconnect resumes with sinceSeq; a server resync or an unknown position refetches', () => {
    const { socket, handlers } = tab();
    socket.fire('connect');
    socket.lastSubscribe()?.ack?.(ack('10'));
    socket.fire('realtime.message', notice('11', '10'));
    socket.fire('connect');
    expect(socket.lastSubscribe()?.payload).toEqual({ sinceSeq: { [ROOM]: '11' } });
    socket.lastSubscribe()?.ack?.(ack('13', [ROOM]));
    expect(handlers.onResync).toHaveBeenCalledWith([ROOM], 'reconnect');

    const fresh = tab();
    fresh.socket.fire('connect');
    fresh.socket.lastSubscribe()?.ack?.(ack(null));
    fresh.socket.fire('connect');
    fresh.socket.lastSubscribe()?.ack?.(ack('20'));
    expect(fresh.handlers.onResync).toHaveBeenCalledWith([ROOM], 'unknown-position');
  });

  it('notices invalidate the affected queries; a resync refetches the whole tenant snapshot', async () => {
    const client = new QueryClient();
    const socket = new FakeSocket();
    const factory: SocketFactory = () => socket;
    client.setQueryData(v2Keys.list('tenant-a', 'production-events'), { items: [] });
    client.setQueryData(v2Keys.list('tenant-a', 'codes'), { items: [] });
    client.setQueryData(v2Keys.list('tenant-b', 'production-events'), { items: [] });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    renderHook(() => useScopedRealtime({ tenantId: 'tenant-a', getAccessToken: () => 'jwt', factory, baseUrl: 'http://api' }), { wrapper });
    socket.fire('connect');
    socket.lastSubscribe()?.ack?.(ack('10'));
    socket.fire('realtime.message', notice('11', '10'));
    const invalidated = () =>
      client
        .getQueryCache()
        .getAll()
        .filter((q) => q.state.isInvalidated)
        .map((q) => `${q.queryKey[1]}/${q.queryKey[2]}`)
        .sort();
    await waitFor(() => expect(invalidated()).toEqual(['tenant-a/production-events']));
    socket.fire('realtime.message', notice('15', '13'));
    await waitFor(() => expect(invalidated()).toEqual(['tenant-a/codes', 'tenant-a/production-events']));
  });
});
