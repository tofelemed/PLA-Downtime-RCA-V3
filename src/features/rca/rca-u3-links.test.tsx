import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { useRcaCase } from '@/api/v2/queries/rca-cases';
import { v2Keys } from '@/api/v2/queries/query-keys';
import type { RcaCaseView } from '@/api/v2/types/rca';
import { CaseWorkspaceContext } from './case/case-context';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('reactflow', async () => {
  const { useState } = await import('react');
  const useFlowState = <T,>(initial: T) => {
    const [value, setValue] = useState(initial);
    return [value, setValue, () => undefined] as const;
  };
  const Nothing = () => null;
  return {
    default: Nothing, Background: Nothing, Controls: Nothing, MiniMap: Nothing, Handle: Nothing, Position: { Top: 'top', Bottom: 'bottom' },
    addEdge: <E,>(edge: E, edges: E[]) => [...edges, edge], useNodesState: useFlowState, useEdgesState: useFlowState,
  };
});

const { AddLinkForm } = await import('./links/add-link-form');
const { LinksTab } = await import('./links/links-tab');
const { EventDiagramTool } = await import('./case/analysis/tools/event-diagram/event-diagram-tool');

interface Call {
  method: string;
  url: URL;
  headers: Headers;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-10T00:00:00Z', scope: { tenantId: 'tenant-a' } });

const CASE = {
  id: 'c1', title: 'Pump trips', status: 'Analysis', priority: 'High', unitId: 'u-1', assetId: null, teamLeadId: null, targetCloseDate: null,
  actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 4, evidence: [], logicTree: [],
  eventDiagram: { nodes: [], edges: [] },
} as unknown as RcaCaseView;

const TRIGGER_LINK = {
  id: 'l1', rcaId: 'c1', linkType: 'event', targetId: 'e-trigger', targetRevision: 1, unitId: 'u-1', source: 'manual', linkedBy: null,
  linkedAt: '2026-10-01T00:00:00Z', reason: null, evidence: { event: { start: '2026-09-30T06:00:00Z', unitId: 'u-1' } },
};

describe('RCA U3 links and diagram', () => {
  let calls: Call[];
  let reply: (call: Call) => Response | null;
  let client: QueryClient;
  const wrap = (node: ReactNode) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>{node}</MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), headers: new Headers(init.headers), body: init.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      return reply(call) ?? json(200, list([]));
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  const linkReply = (call: Call) => {
    if (call.method === 'POST') return json(201, { link: { ...TRIGGER_LINK, ...call.body, id: 'l2' }, created: true, caseCreated: false, rca: CASE });
    return call.url.pathname.endsWith('/links') ? json(200, []) : null;
  };
  const lastGet = (suffix: string) => [...calls].reverse().find((call) => call.method === 'GET' && call.url.pathname.endsWith(suffix));

  it('links an occurrence picked from a window around the trigger event', async () => {
    reply = (call) => {
      const path = call.url.pathname;
      if (path.endsWith('/rcas/c1/links') && call.method === 'GET') return json(200, [TRIGGER_LINK]);
      if (path.endsWith('/production-events')) return json(200, list([{ id: 'e-trigger', unitId: 'u-1', startTime: '2026-09-30T06:00:00Z', description: 'Trip', classification: { physicalType: 'downtime' } }]));
      if (path.endsWith('/occurrences')) {
        return json(200, list([{ occurrenceId: 'occ-1', unitId: 'u-1', startTime: '2026-09-29T06:00:00Z', endTime: null, eventCount: 2, firstEventId: 'e9', description: 'Seal leak', assetId: null, assetName: 'P-101', reasonCodeId: null, reasonName: 'Seal', linkedRcaIds: [] }]));
      }
      return linkReply(call);
    };
    wrap(<AddLinkForm rcaId="c1" />);
    expect(await screen.findByText('Linked')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'occurrence' } });
    const pick = await screen.findByRole('button', { name: /^Link occurrence from/ });
    const params = lastGet('/occurrences')?.url.searchParams;
    expect(new Date(params?.get('from') ?? '').toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(new Date(params?.get('to') ?? '').toISOString()).toBe('2026-10-16T00:00:00.000Z');
    expect(params?.get('sort')).toBe('-startTime');
    fireEvent.click(pick);
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ linkType: 'occurrence', targetId: 'occ-1' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Linked.');
  });

  it('links an approved loss line by its id, and keeps a raw reference under Advanced', async () => {
    reply = (call) => {
      if (call.url.pathname.endsWith('/loss-lines')) {
        return json(200, list([{ id: 'll-1', periodId: 'p1', unitId: 'u-1', localDate: '2026-10-09', shiftName: 'A', periodStart: '2026-10-09T00:00:00Z', revisionId: 'r', revision: 1, lifecycle: 'approved', runId: 'run', kind: 'availability', quantity: '12.5', uom: 't', basis: 'b', segmentStart: 'x', segmentEnd: 'y', reasonCodeId: null, reasonCode: 'DP', reasonName: 'Die plate', causeEventId: null, causeEventDescription: 'Trip', occurrenceId: null }]));
      }
      return linkReply(call);
    };
    wrap(<AddLinkForm rcaId="c1" />);
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'loss_line' } });
    fireEvent.click(await screen.findByRole('button', { name: /^Link loss line of/ }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ linkType: 'loss_line', targetId: 'll-1' }));
    expect(lastGet('/loss-lines')?.url.searchParams.get('sort')).toBe('-periodStart');
    const raw = screen.getByTestId('raw-reference');
    fireEvent.change(within(raw).getByLabelText('Reference type'), { target: { value: 'work_order' } });
    fireEvent.change(within(raw).getByLabelText('Reference'), { target: { value: ' WO-77 ' } });
    fireEvent.click(within(raw).getByRole('button', { name: 'Link reference' }));
    await waitFor(() => expect(calls.filter((call) => call.method === 'POST').at(-1)?.body).toEqual({ linkType: 'work_order', targetId: 'WO-77' }));
  });

  it('Marun G4: a line linked under an earlier run of its period reads "Linked"; a closed case offers no link form', async () => {
    const line = { periodId: 'p1', kind: 'availability', causeEventId: 'e-stop', segmentStart: '2026-10-09T06:00:00.000Z', segmentEnd: '2026-10-09T07:00:00.000Z' };
    const oldLink = { ...TRIGGER_LINK, id: 'l3', linkType: 'loss_line', targetId: 'll-old', evidence: { kind: 'loss_line', line: { id: 'll-old', ...line } } };
    reply = (call) => {
      if (call.url.pathname.endsWith('/loss-lines')) {
        return json(200, list([{ id: 'll-new', unitId: 'u-1', localDate: '2026-10-09', shiftName: 'A', periodStart: '2026-10-09T00:00:00Z', revisionId: 'r2', revision: 2, lifecycle: 'approved', runId: 'run2', quantity: '28', uom: 't', basis: 'planning_rate', reasonCodeId: null, reasonCode: null, reasonName: null, causeEventDescription: 'Trip', occurrenceId: null, ...line, segmentStart: '2026-10-09T06:00:00Z', segmentEnd: '2026-10-09T07:00:00Z' }]));
      }
      if (call.url.pathname.endsWith('/links')) return json(200, [oldLink]);
      return null;
    };
    const first = wrap(<AddLinkForm rcaId="c1" />);
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'loss_line' } });
    const picker = await screen.findByTestId('loss-line-picker');
    expect(await within(picker).findByText('Linked')).toBeInTheDocument();
    expect(within(picker).queryByRole('button', { name: /^Link loss line of/ })).toBeNull();
    first.unmount();
    wrap(<LinksTab rcaId="c1" timezone="UTC" closed />);
    expect(await screen.findByTestId('links-closed')).toHaveTextContent('reopen it to add a link');
    expect(screen.queryByTestId('add-link')).toBeNull();
  });

  function DiagramHarness() {
    const detail = useRcaCase('c1');
    if (!detail.data) return null;
    return (
      <CaseWorkspaceContext.Provider value={{ rca: detail.data, readOnly: false, canWrite: true, closed: false, basePath: '/rca/c1' }}>
        <EventDiagramTool />
      </CaseWorkspaceContext.Provider>
    );
  }

  it('F-6: saves the diagram with the version it opened with and offers "Reload latest" on 412', async () => {
    const key = v2Keys.detail('tenant-a', 'rca-cases', 'c1', undefined);
    client.setQueryData(key, CASE);
    const latest = { ...CASE, rowVersion: 8, eventDiagram: { nodes: [{ id: 'event-9', label: 'Trip', type: 'Failure', timestamp: null, description: null, asset: null, severity: null, position: { x: 0, y: 0 } }], edges: [] } };
    reply = (call) => {
      if (call.method === 'PATCH') return json(412, { code: 'PRECONDITION_FAILED', message: 'changed', correlationId: 'x', retryable: false });
      if (call.url.pathname.endsWith('/rcas/c1')) return json(200, latest);
      return null;
    };
    wrap(<DiagramHarness />);
    fireEvent.click(await screen.findByTestId('add-event'));
    fireEvent.change(screen.getByLabelText(/What happened/), { target: { value: 'High vibration alarm' } });
    fireEvent.click(screen.getByTestId('save-event'));
    client.setQueryData(key, { ...CASE, rowVersion: 7 });
    fireEvent.click(await screen.findByTestId('save-tool'));
    await waitFor(() => expect(calls.find((call) => call.method === 'PATCH')?.headers.get('If-Match')).toBe('"4"'));
    fireEvent.click(await screen.findByTestId('reload-latest'));
    expect(await screen.findByTestId('kept-text')).toHaveTextContent('Event: High vibration alarm');
    expect(screen.queryByTestId('tool-conflict')).toBeNull();
  });
});
