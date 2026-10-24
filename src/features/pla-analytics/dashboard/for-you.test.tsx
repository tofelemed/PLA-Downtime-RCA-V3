import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch, type V2Call } from '@/test/v2-fetch';
import { dashboardScope } from '../model/dashboard-scope';
import { forYouTilesOf, pageCountText } from './for-you-model';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ tenantId: 'tenant-a', timezone: 'UTC', timezoneIsFallback: false }) }));

const { ForYouRow } = await import('./for-you-row');

const NOW = Date.parse('2026-10-18T08:00:00Z');
const items = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `row-${index}` }));

function reply(call: V2Call): Response | undefined {
  const path = call.url.pathname;
  if (path.endsWith('/production-events')) return jsonResponse(200, listPage(items(3), 'next'));
  if (path.endsWith('/reconciliation-queue')) return jsonResponse(200, listPage(items(2)));
  if (path.endsWith('/rca-actions')) return jsonResponse(200, listPage(items(4)));
  if (path.endsWith('/approval-inbox')) return jsonResponse(200, listPage(items(5)));
  return undefined;
}

function renderRow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ForYouRow scope={dashboardScope('7d', {}, NOW)} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('dashboard "For you" row (UX audit §5.6)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('picks the tiles from the effective roles, each once and in a fixed order', () => {
    expect(forYouTilesOf(['operator'])).toEqual(['currentStops', 'stopsToCode']);
    expect(forYouTilesOf(['production_engineer', 'Operator'])).toEqual(['currentStops', 'stopsToCode']);
    expect(forYouTilesOf(['manager_approver', 'production_accountant'])).toEqual(['periodsDue', 'approvals']);
    expect(forYouTilesOf(['reliability_engineer'])).toEqual(['recommended', 'myOverdueActions']);
    expect(forYouTilesOf(['viewer'])).toEqual([]);
  });

  it('every approver role gets the Pending approvals tile, not only manager approvers (QA audit 2026-10-19)', () => {
    for (const role of ['finance_approver', 'quality_approver', 'metrology_approver', 'production_accountant', 'SuperAdmin']) {
      expect(forYouTilesOf([role])).toContain('approvals');
    }
    expect(forYouTilesOf(['Analyst', 'finance_approver'])).toEqual(['approvals']);
    expect(forYouTilesOf(['operator'])).not.toContain('approvals');
  });

  it('the approvals tile counts only what the caller can decide', async () => {
    actAs('finance_approver');
    const calls = stubV2Fetch(reply);
    renderRow();
    expect(await screen.findByRole('link', { name: /Pending approvals: 5/ })).toBeInTheDocument();
    const inbox = calls.find((call) => call.url.pathname.endsWith('/approval-inbox'));
    expect(inbox?.url.searchParams.get('decidable')).toBe('true');
  });

  it('shows a page count with "+" when the server has a further page', () => {
    const format = (value: number) => String(value);
    expect(pageCountText(50, true, format)).toBe('50+');
    expect(pageCountText(0, false, format)).toBe('0');
  });

  it('operator: current stops from the live-stops query, and the count of uncoded stops of the window (QA re-test)', async () => {
    actAs('operator');
    const calls = stubV2Fetch(reply);
    renderRow();
    expect(await screen.findByRole('link', { name: 'Current stops: 3+, open the list' })).toHaveAttribute('href', '/downtime?window=7d');
    expect(await screen.findByRole('link', { name: 'Stops to code: 3+, open the list' })).toHaveAttribute('href', '/events?kinds=downtime&coding=uncoded&window=7d');
    const current = calls.find((call) => call.url.pathname.endsWith('/production-events') && call.url.searchParams.get('isOpen') === 'true');
    expect(current?.url.searchParams.get('codingStates')).toBeNull();
    const toCode = calls.find((call) => call.url.pathname.endsWith('/production-events') && call.url.searchParams.get('codingStates') === 'uncoded');
    expect(toCode?.url.searchParams.get('physicalTypes')).toBe('downtime');
    expect(toCode?.url.searchParams.get('from')).toBeTruthy();
  });

  it('accountant: periods due of My work', async () => {
    actAs('production_accountant');
    stubV2Fetch(reply);
    renderRow();
    expect(await screen.findByRole('link', { name: 'Periods due: 2, open the list' })).toHaveAttribute('href', '/my-queue');
  });

  it('reliability engineer: recommended investigations link and own overdue actions', async () => {
    actAs('reliability_engineer');
    const calls = stubV2Fetch(reply);
    renderRow();
    expect(await screen.findByRole('link', { name: 'My overdue actions: 4, open the list' })).toHaveAttribute('href', '/rca?tab=actions&overdue=true');
    expect(screen.getByRole('link', { name: 'View recommended investigations' })).toHaveAttribute('href', '/rca?tab=recommended');
    const actions = calls.find((call) => call.url.pathname.endsWith('/rca-actions'));
    expect([actions?.url.searchParams.get('mine'), actions?.url.searchParams.get('overdue')]).toEqual(['true', 'true']);
  });

  it('manager: pending approvals', async () => {
    actAs('manager_approver');
    stubV2Fetch(reply);
    renderRow();
    expect(await screen.findByRole('link', { name: 'Pending approvals: 5, open the list' })).toHaveAttribute('href', '/approvals');
  });

  it('manager with exactly one pending approval: the tile opens that record', async () => {
    actAs('manager_approver');
    stubV2Fetch((call) =>
      call.url.pathname.endsWith('/approval-inbox') ? jsonResponse(200, listPage([{ id: 'plan-v-1', kind: 'plan' }])) : reply(call),
    );
    renderRow();
    expect(await screen.findByRole('link', { name: 'Pending approvals: 1, open it' })).toHaveAttribute('href', '/approvals/plan/plan-v-1');
  });

  it('shows no row when no role asks for a tile', () => {
    actAs('viewer');
    const calls = stubV2Fetch(reply);
    renderRow();
    expect(screen.queryByTestId('dashboard-for-you')).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
