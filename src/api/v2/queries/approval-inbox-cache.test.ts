import { describe, expect, it } from 'vitest';
import { QueryClient, QueryObserver, type InfiniteData } from '@tanstack/react-query';
import type { ApprovalItem } from '../types/approvals';
import type { ListResponse } from '../types/envelopes';
import { v2Keys } from './query-keys';
import { invalidateForChange } from './invalidation';
import { removeDecidedApproval } from './approval-inbox-cache';

type Pages = InfiniteData<ListResponse<ApprovalItem>, string | null>;
const key = (tenant = 'plant-a', workflow?: string) => v2Keys.list(tenant, 'close', { filters: { kind: 'approval-inbox', workflow } });
const row = (id: string, kind = 'profile'): ApprovalItem => ({ id, kind, kindLabel: kind, title: id, summary: '', state: 'draft', createdAt: '2026-10-17T00:00:00Z', unitId: null, unitName: null, authorId: null, authorName: null, requiredRoles: [], reviewHref: '/planning', resource: 'profiles', commandId: id, version: 1, rowVersion: 1, supersede: false, actions: [], canDecide: true, decisionBlockedReason: null, headline: null, target: { periodId: null, planId: null, revision: null, monthKey: null, eventId: null, profileId: null } });
const pages = (...groups: ApprovalItem[][]): Pages => ({ pages: groups.map((items, index) => ({ items, nextCursor: index < groups.length - 1 ? 'next' : null, asOf: 'now', scope: { tenantId: 'plant-a' } })), pageParams: groups.map((_, index) => index ? 'next' : null) });
const ids = (value: Pages | undefined) => value?.pages.flatMap((page) => page.items.map((item) => `${item.kind}:${item.id}`));

describe('approval inbox freshness after workflow decisions', () => {
  it('removes a confirmed record across cached pages and filters while preserving other records and plants', async () => {
    const client = new QueryClient();
    client.setQueryData(key(), pages([row('one')], [row('two'), row('one', 'rule')]));
    client.setQueryData(key('plant-a', 'profile'), pages([row('two'), row('one')]));
    client.setQueryData(key('plant-b'), pages([row('one')]));
    const otherClose = v2Keys.list('plant-a', 'close', { filters: { kind: 'reconciliation-queue' } });
    client.setQueryData(otherClose, { unchanged: true });
    await removeDecidedApproval(client, 'plant-a', row('one'));
    expect(ids(client.getQueryData(key()))).toEqual(['profile:two', 'rule:one']);
    expect(ids(client.getQueryData(key('plant-a', 'profile')))).toEqual(['profile:two']);
    expect(ids(client.getQueryData(key('plant-b')))).toEqual(['profile:one']);
    expect(client.getQueryData(otherClose)).toEqual({ unchanged: true });
    client.clear();
  });
  it('cancels pre-decision reads so a late response cannot restore a decided row', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const old = pages([row('one'), row('two')]);
    client.setQueryData(key(), old);
    let resolveOld!: (value: Pages) => void;
    const request = client.fetchQuery({ queryKey: key(), queryFn: () => new Promise<Pages>((resolve) => { resolveOld = resolve; }), staleTime: 0 }).catch(() => undefined);
    await removeDecidedApproval(client, 'plant-a', row('one'));
    resolveOld(old);
    await request;
    expect(ids(client.getQueryData(key()))).toEqual(['profile:two']);
    client.clear();
  });
  it('a decision in another workspace refreshes an active inbox even when its normal resource is profiles', async () => {
    const client = new QueryClient();
    client.setQueryData(key(), pages([row('one')]));
    let reads = 0;
    const observer = new QueryObserver(client, { queryKey: key(), queryFn: async () => { reads += 1; return pages([]); }, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => undefined);
    await invalidateForChange(client, { tenantId: 'plant-a', entityType: 'production_profile', entityId: 'one' });
    expect(reads).toBe(1);
    expect(ids(client.getQueryData(key()))).toEqual([]);
    unsubscribe(); client.clear();
  });
  it('discards inactive inbox snapshots on workflow changes, without discarding another plant or My Queue', async () => {
    const client = new QueryClient();
    client.setQueryData(key(), pages([row('one')]));
    client.setQueryData(key('plant-a', 'profile'), pages([row('one')]));
    client.setQueryData(key('plant-b'), pages([row('one')]));
    const queue = v2Keys.list('plant-a', 'close', { filters: { kind: 'reconciliation-queue' } });
    client.setQueryData(queue, { retained: true });
    await invalidateForChange(client, { tenantId: 'plant-a', entityType: 'fx_rate' });
    expect(client.getQueryData(key())).toBeUndefined();
    expect(client.getQueryData(key('plant-a', 'profile'))).toBeUndefined();
    expect(ids(client.getQueryData(key('plant-b')))).toEqual(['profile:one']);
    expect(client.getQueryData(queue)).toEqual({ retained: true });
    client.clear();
  });
});
