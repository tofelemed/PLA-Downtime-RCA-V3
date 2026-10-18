import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { QueueItemView } from '@/api/v2/types/period-sla';
import { jsonResponse, listPage, stubV2Fetch, type V2Call } from '@/test/v2-fetch';
import { myWorkSearchOf, myWorkTabOf } from './my-work-tabs';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'UTC', source: 'tenant', loading: false }) }));
vi.mock('@/features/rca/actions/my-rca-actions-list', () => ({
  MyRcaActionsList: (props: { mine?: boolean; limit?: number }) => <div data-testid="rca-actions-embed" data-mine={String(props.mine)} data-limit={props.limit} />,
}));

const { MyQueuePage } = await import('./my-queue-page');

const base: QueueItemView = {
  periodId: 'per-1', unitId: 'u1', unitName: 'Unit 100', planId: 'plan-1', localDate: '2026-10-10', shiftName: null,
  utcStart: '2026-10-10T00:00:00.000Z', utcEnd: '2026-10-11T00:00:00.000Z', workflowState: 'submitted', revision: 1,
  task: 'escalated', dueAt: '2026-10-12T00:00:00.000Z', overdue: true, escalationLevel: 1, escalatedTo: 'production_accountant',
  onHold: false, rejections: 0, rejectionEscalated: false,
};
const later: QueueItemView = { ...base, periodId: 'per-2', task: 'prepare', overdue: false, escalationLevel: 0, escalatedTo: null, dueAt: '2099-01-01T00:00:00.000Z' };
const task = {
  id: 'task-1', title: 'Replace seal', description: null, assigneeId: 'user-1', assigneeName: 'Test user', assignedById: 'user-2', assignedByName: null,
  priority: 'High', status: 'Open', dueDate: '2026-10-20T00:00:00.000Z', completedAt: null, overdue: false, linkType: null, linkId: null,
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
};

function reply(call: V2Call): Response | undefined {
  if (call.url.pathname.endsWith('/reconciliation-queue')) return jsonResponse(200, listPage([base, later]));
  if (call.url.pathname.endsWith('/tasks')) return jsonResponse(200, listPage([task]));
  return undefined;
}

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function open(path = '/my-queue') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <MyQueuePage />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('My work page (UX audit §5.7)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps ?tab= to a tab, defaulting to Periods with a clean URL', () => {
    expect(['rca-actions', 'tasks', 'other', null].map(myWorkTabOf)).toEqual(['rca-actions', 'tasks', 'periods', 'periods']);
    expect(myWorkSearchOf('periods')).toEqual({});
    expect(myWorkSearchOf('tasks')).toEqual({ tab: 'tasks' });
  });

  it('Periods: groups rows, keeps escalation neutral (red only for Overdue) and offers Open per row', async () => {
    const calls = stubV2Fetch(reply);
    open();
    expect(screen.getByRole('heading', { level: 1, name: 'My work' })).toBeInTheDocument();
    const overdue = await screen.findByRole('table', { name: 'My reconciliation queue: Overdue' });
    expect(screen.getByRole('table', { name: 'My reconciliation queue: Later' })).toBeInTheDocument();
    expect(within(overdue).getByTestId('queue-task')).not.toHaveAttribute('data-tone', 'danger');
    expect(within(overdue).getByTestId('sla-overdue')).toHaveAttribute('data-tone', 'danger');
    expect(within(overdue).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/plans/plan-1/periods/per-1');
    expect(calls.every((call) => call.url.pathname.endsWith('/reconciliation-queue'))).toBe(true);
  });

  it('RCA actions: embeds the user\'s own actions list', async () => {
    stubV2Fetch(reply);
    open('/my-queue?tab=rca-actions');
    const embed = await screen.findByTestId('rca-actions-embed');
    expect(embed).toHaveAttribute('data-mine', 'true');
    expect(screen.getByTestId('my-work-tab-rca-actions')).toHaveAttribute('data-state', 'active');
  });

  it('Tasks: lists the user\'s open tasks from the server filter and links to the full list', async () => {
    const calls = stubV2Fetch(reply);
    open('/my-queue?tab=tasks');
    expect(await screen.findByText('Replace seal')).toBeInTheDocument();
    const request = calls.find((call) => call.url.pathname.endsWith('/tasks'));
    expect(request?.url.searchParams.get('assignedToMe')).toBe('true');
    expect(request?.url.searchParams.getAll('statuses').join(',')).toMatch(/Open.*In Progress|In Progress.*Open/);
    expect(screen.getByRole('link', { name: 'All my tasks' })).toHaveAttribute('href', '/tasks?mine=1');
    expect(screen.queryByRole('columnheader', { name: 'Assignee' })).toBeNull();
  });

  it('switching tabs writes ?tab= (and clears it for Periods)', async () => {
    stubV2Fetch(reply);
    open('/my-queue?tab=tasks');
    fireEvent.mouseDown(screen.getByTestId('my-work-tab-rca-actions'));
    expect(screen.getByTestId('location')).toHaveTextContent('?tab=rca-actions');
    fireEvent.mouseDown(screen.getByTestId('my-work-tab-periods'));
    expect(screen.getByTestId('location')).toHaveTextContent(/^$/);
  });
});
