import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureV2Session } from '@/api/v2/config';
import type { DayView } from '@/api/v2/types/production-day';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { DayCertificationPanel } = await import('./day/day-certification-panel');

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const shift = (name: string) => ({ periodId: `p-${name}`, shiftName: name, utcStart: '2026-10-08T02:30:00.000Z', isExcluded: false, workflow: 'approved', revision: 1, submittedBy: 'preparer-1' });

const READY: DayView = {
  unitId: 'u1',
  localDate: '2026-10-08',
  state: 'ready',
  periods: [shift('A'), shift('B'), shift('C')],
  certification: null,
  rollup: [{ uom: 't', periods: 3, target: '3000', actual: '300', gap: '2700', attributed: '2700', residual: '0' }],
};

describe('day certification panel (SME R2, owner decision 14 Oct)', () => {
  let posts: string[];
  beforeEach(() => {
    posts = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (init.method === 'POST') {
        posts.push(new URL(url).pathname);
        return json(200, { ...READY, state: 'certified' });
      }
      return json(200, READY);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  const wrap = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <DayCertificationPanel unitId="u1" localDate="2026-10-08" />
      </QueryClientProvider>,
    );

  it('plant management certifies a ready day; the roll-up is the server’s', async () => {
    actAs('manager_approver', 'manager-1');
    wrap();
    expect((await screen.findByTestId('day-rollup')).textContent).toContain('3 shifts');
    fireEvent.click(screen.getByTestId('day-certify'));
    await waitFor(() => expect(posts).toEqual(['/api/v2/production-days/u1/2026-10-08/certify']));
  });

  it('a submitter of a shift cannot certify the day', async () => {
    actAs('manager_approver', 'preparer-1');
    wrap();
    expect(((await screen.findByTestId('day-certify')) as HTMLButtonElement).disabled).toBe(true);
  });
});
