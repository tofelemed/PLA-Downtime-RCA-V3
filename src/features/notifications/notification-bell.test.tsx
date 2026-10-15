import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { NotificationView } from '@/api/v2/types/notifications';
import { notificationText } from './notification-text';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'tenant', loading: false }) }));

const { NotificationBell } = await import('./notification-bell');

interface Call {
  method: string;
  url: URL;
}

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const ESCALATION: NotificationView = {
  id: 'n1',
  kind: 'sla_escalation',
  entityType: 'production_period',
  entityId: 'per-1',
  detail: {
    reason: 'age',
    role: 'production_accountant',
    level: 1,
    afterHours: 48,
    rejections: null,
    periodId: 'per-1',
    unitId: 'u1',
    unitName: 'Demo unit 100',
    planId: 'plan-1',
    localDate: '2026-10-12',
    shiftName: 'B',
    escalatedAt: '2026-10-15T06:00:00.000Z',
  },
  read: false,
  readAt: null,
  createdAt: '2026-10-15T06:00:00.000Z',
};

describe('notification text (SME R3 / R6)', () => {
  it('names the role, the period in the plant calendar and digits, and links the period page', () => {
    expect(notificationText(ESCALATION, {})).toEqual({
      title: 'Escalated to Production accountant',
      body: 'Demo unit 100 · 2026-10-12 · B: not approved 48 hours after the production day ended',
      href: '/plans/plan-1/periods/per-1',
    });
    const persian = notificationText(ESCALATION, { calendar: 'persian', digits: 'persian' });
    expect(persian.body).toContain('۴۸');
    expect(persian.body).not.toContain('2026-10-12');
    const rejected = notificationText({ ...ESCALATION, detail: { ...ESCALATION.detail, reason: 'rejections', rejections: 3, afterHours: null } }, {});
    expect(rejected.body).toContain('rejected 3 times');
  });

  it('due reminders (SME R3): submission for the preparer, approval for the checker', () => {
    const detail = { ...ESCALATION.detail, reason: 'due', stage: 'submit', recipient: 'preparer', dueAt: '2026-10-12T18:00:00.000Z', remindedAt: '2026-10-12T18:10:00.000Z' };
    const submit = notificationText({ ...ESCALATION, kind: 'sla_reminder', detail }, {});
    expect(submit).toEqual({ title: 'Submission due', body: 'Demo unit 100 · 2026-10-12 · B: the reconciliation is due for submission', href: '/plans/plan-1/periods/per-1' });
    const approve = notificationText({ ...ESCALATION, kind: 'sla_reminder', detail: { ...detail, stage: 'approve', recipient: 'checker' } }, {});
    expect(approve.title).toBe('Approval due');
  });
});

describe('notification bell', () => {
  let calls: Call[];

  beforeEach(() => {
    calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const call = { method: init.method ?? 'GET', url: new URL(url) };
        calls.push(call);
        if (call.url.pathname.endsWith('/unread-count')) return json({ unread: 1 });
        if (call.method === 'POST') return json({ ...ESCALATION, read: true });
        return json({ items: [ESCALATION], nextCursor: null, asOf: '2026-10-15T07:00:00.000Z', scope: { tenantId: 'tenant-a' } });
      }),
    );
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the unread count, lists on open and marks the opened notification read', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect((await screen.findByTestId('notification-unread')).textContent).toBe('1');
    expect(calls.some((c) => c.url.pathname.endsWith('/v2/notifications'))).toBe(false);
    fireEvent.click(screen.getByTestId('notification-bell'));
    const item = await screen.findByTestId('notification');
    expect(item.textContent).toContain('Escalated to Production accountant');
    fireEvent.click(screen.getByRole('link'));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.url.pathname).toMatch(/\/v2\/notifications\/n1\/read$/);
  });
});
