import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureV2Session } from '../config';
import { fromSessionBootstrap, resetSessionBootstrap, type SessionBootstrap } from './session-bootstrap';

const v2Request = vi.hoisted(() => vi.fn());
vi.mock('../client', () => ({ v2Request }));

const BOOTSTRAP = {
  branding: { appName: 'Pro-Act' },
  featureFlags: { items: [], asOf: '2026-10-20T00:00:00Z', scope: { tenantId: 't1' } },
  unreadNotifications: { unread: 4 },
  sites: { items: [{ id: 's1' }], nextCursor: null },
  plant: { id: 't1', name: 'HDPE' },
  directory: { organizations: [{ id: 'o1' }], plants: [{ id: 't1' }] },
} as unknown as SessionBootstrap;

let tenantId: string | null = 't1';
let unconfigure: () => void = () => undefined;

beforeEach(() => {
  resetSessionBootstrap();
  v2Request.mockReset();
  v2Request.mockResolvedValue({ data: BOOTSTRAP });
  tenantId = 't1';
  unconfigure = configureV2Session({
    getAccessToken: () => 'token',
    getTenantId: () => tenantId,
    getSessionKey: () => 'session-1',
    refresh: async () => true,
    onSessionExpired: () => undefined,
  });
});
afterEach(() => {
  unconfigure();
  vi.useRealTimers();
});

const alone = <T,>(value: T) => vi.fn(async () => value);

describe('fromSessionBootstrap (perf audit P08)', () => {
  it('serves the shell queries that load together from one bootstrap request', async () => {
    const fallbacks = [alone({}), alone({}), alone([])];
    const [branding, unread, organizations] = await Promise.all([
      fromSessionBootstrap('branding', fallbacks[0] as never),
      fromSessionBootstrap('unreadNotifications', fallbacks[1] as never),
      fromSessionBootstrap('organizations', fallbacks[2] as never),
    ]);
    expect(branding).toEqual({ appName: 'Pro-Act' });
    expect(unread).toEqual({ unread: 4 });
    expect(organizations).toEqual([{ id: 'o1' }]);
    expect(v2Request).toHaveBeenCalledTimes(1);
    expect(v2Request).toHaveBeenCalledWith({ method: 'GET', path: '/session/bootstrap' });
    fallbacks.forEach((fallback) => expect(fallback).not.toHaveBeenCalled());
  });

  it('sends a refetch of the same part to its own endpoint', async () => {
    await fromSessionBootstrap('unreadNotifications', alone({ unread: 0 }));
    const fresh = alone({ unread: 9 });
    expect(await fromSessionBootstrap('unreadNotifications', fresh)).toEqual({ unread: 9 });
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(v2Request).toHaveBeenCalledTimes(1);
  });

  it('falls back to the own endpoint when the bootstrap fails', async () => {
    v2Request.mockRejectedValueOnce(new Error('503'));
    const fallback = alone({ unread: 2 });
    expect(await fromSessionBootstrap('unreadNotifications', fallback)).toEqual({ unread: 2 });
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('starts a new batch for another acting tenant', async () => {
    await fromSessionBootstrap('plant', alone({}) as never);
    tenantId = 't2';
    await fromSessionBootstrap('plant', alone({}) as never);
    expect(v2Request).toHaveBeenCalledTimes(2);
  });

  it('only covers the first load: after 30 s a query fetches alone', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T08:00:00Z'));
    await fromSessionBootstrap('branding', alone({}) as never);
    vi.setSystemTime(new Date('2026-10-20T08:00:31Z'));
    const fallback = alone({ appName: 'late' });
    expect(await fromSessionBootstrap('sites', fallback as never)).toEqual({ appName: 'late' });
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('fetches alone without an acting tenant', async () => {
    tenantId = null;
    const fallback = alone({ unread: 1 });
    expect(await fromSessionBootstrap('unreadNotifications', fallback)).toEqual({ unread: 1 });
    expect(v2Request).not.toHaveBeenCalled();
  });
});
