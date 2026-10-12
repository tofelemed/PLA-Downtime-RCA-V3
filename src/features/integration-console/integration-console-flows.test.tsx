import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ConnectionView, IngestionExceptionDetailView, IngestionJobView } from '@/api/v2/types/integrations';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { ConnectionWizard } = await import('./connections/connection-wizard');
const { DiagnosticsPanel } = await import('./connections/diagnostics-panel');
const { ExceptionActions } = await import('./quarantine/exception-actions');
const { JobRow } = await import('./jobs/job-row');
const { ConnectionHeader } = await import('./connections/connection-header');

interface Call {
  method: string;
  url: URL;
  headers: Headers;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const refusal = (code: string) => ({ code, message: code, correlationId: 'corr-1', retryable: false });
const SECRET = 'typed-once-test-secret';

const CONNECTION: ConnectionView = {
  id: 'c1', sourceType: 'pi_web_api', displayName: 'PI sim', endpointConfig: { piWebApiUrl: 'http://127.0.0.1:9/piwebapi' }, hasSecret: true, effectiveClientId: null,
  capabilities: {}, configVersion: 1, isActive: true, rowVersion: 1, createdAt: '2026-10-10T00:00:00Z', updatedAt: null,
};

describe('integration console flows (plan 3.7)', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode) => render(<MemoryRouter><QueryClientProvider client={client}>{node}</QueryClientProvider></MemoryRouter>);

  beforeEach(() => {
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), headers: new Headers(init.headers), body: init.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      return reply(call);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('Kafka is not selectable, MQTT is; a PI connection sends the password once and never keeps it', async () => {
    reply = () => json(201, CONNECTION);
    const onSaved = vi.fn();
    wrap(<ConnectionWizard connection={null} onClose={() => undefined} onSaved={onSaved} />);
    expect(screen.getByTestId('source-type-mqtt')).toBeEnabled();
    expect(screen.getByTestId('source-type-kafka')).toBeDisabled();
    expect(screen.getByTestId('source-type-kafka').textContent).not.toMatch(/Ddd/);
    fireEvent.click(screen.getByTestId('source-type-pi_web_api'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'PI sim' } });
    fireEvent.change(screen.getByLabelText('PI Web API URL'), { target: { value: 'http://127.0.0.1:9/piwebapi' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: SECRET } });
    fireEvent.click(screen.getByTestId('connection-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(CONNECTION));
    const [post] = calls;
    expect(post.url.pathname).toMatch(/\/v2\/connections$/);
    expect(post.body).toMatchObject({ sourceType: 'pi_web_api', secret: SECRET, endpointConfig: { piWebApiUrl: 'http://127.0.0.1:9/piwebapi' } });
    expect(JSON.stringify(post.body?.endpointConfig)).not.toContain(SECRET);
    expect(post.headers.get('Idempotency-Key')).toBeTruthy();
    expect(JSON.stringify({ ...localStorage })).not.toContain(SECRET);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(SECRET);
    expect((screen.getByTestId('pi-secret') as HTMLInputElement).value).toBe('');
  });

  it('a 403 on the diagnostics is shown as a plain role refusal; the code stays out of the text', async () => {
    reply = () => json(403, refusal('FORBIDDEN_ROLE'));
    wrap(<DiagnosticsPanel connection={CONNECTION} last={null} timezone="UTC" onTested={() => undefined} />);
    fireEvent.click(screen.getByTestId('run-diagnostics'));
    await waitFor(() => expect(screen.getByTestId('refusal').getAttribute('data-kind')).toBe('role'));
    expect(screen.getByTestId('refusal').getAttribute('data-code')).toBe('FORBIDDEN_ROLE');
    expect(screen.getByTestId('refusal').textContent).not.toMatch(/FORBIDDEN_ROLE|corr-1/);
    expect(screen.getAllByTestId('diagnostic-step').map((step) => step.getAttribute('data-status'))).toEqual(Array(6).fill('not_run'));
  });

  it('stop asks for confirmation and sends the audited reason with an Idempotency-Key; 409 is shown', async () => {
    reply = (call) => (call.method === 'POST' ? json(409, refusal('INVALID_TRANSITION')) : json(200, []));
    const job: IngestionJobView = {
      id: 'j1', connectionId: 'c1', scope: { mode: 'window', purpose: 'limited' }, state: 'running', leaseOwner: null, leaseExpiry: null, heartbeatAt: null,
      committedCursor: { checkpoint: '2026-10-10T06:00:00.000Z' }, lastObservationAt: null, lastSuccessAt: null, retryCount: 0, lastError: null,
      cadence: { intervalSeconds: 60, pageSize: 50 }, nextRunAt: null, health: {}, rowVersion: 1, createdAt: null, updatedAt: null,
    };
    wrap(<JobRow job={job} timezone="UTC" now={Date.parse('2026-10-10T08:00:00Z')} />);
    expect(screen.queryByTestId('job-resume')).toBeNull();
    fireEvent.click(screen.getByTestId('job-stop'));
    fireEvent.change(screen.getByLabelText('Reason (audited)'), { target: { value: 'mapping check done' } });
    fireEvent.click(screen.getByTestId('job-command-confirm'));
    await waitFor(() => expect(screen.getByTestId('refusal').getAttribute('data-code')).toBe('INVALID_TRANSITION'));
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.url.pathname).toMatch(/\/v2\/ingestion-jobs\/j1\/stop$/);
    expect(post?.body).toEqual({ reason: 'mapping check done' });
    expect(post?.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('quarantine: dry run counts first, then replay-and-resolve (202) shows the run', async () => {
    reply = (call) => {
      if (call.url.pathname.endsWith('/replays')) return json(202, { jobId: 'dry-1', statusUrl: '/api/v2/replay-runs/dry-1' });
      if (call.url.pathname.endsWith('/replay-runs/dry-1')) return json(200, { id: 'dry-1', connectionId: 'c1', dryRun: true, state: 'completed', counts: { objects: 1 }, reason: 'x', from: null, to: null, scopes: null, requestedBy: null, lastError: null, createdAt: null, finishedAt: null });
      if (call.url.pathname.endsWith('/resolve')) return json(202, { jobId: 'run-2', statusUrl: '/api/v2/replay-runs/run-2' });
      return json(200, { id: 'run-2', connectionId: 'c1', dryRun: false, state: 'completed', counts: { objects: 1, normalized: 1 }, reason: 'x', from: null, to: null, scopes: null, requestedBy: null, lastError: null, createdAt: null, finishedAt: null });
    };
    const exception = { id: 'e1', connectionId: 'c1', sourceObjectId: 'EF-1', rawId: 'r', errorCode: 'unknown_unit', detail: null, state: 'open', ownerId: null, firstSeen: null, lastSeen: null, occurrences: 1, resolution: null, replayRunId: null, rowVersion: 1, raw: null } as IngestionExceptionDetailView;
    wrap(<ExceptionActions exception={exception} />);
    expect(screen.getByTestId('exception-replay')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reason (audited, required)'), { target: { value: 'unit bound' } });
    fireEvent.click(screen.getByTestId('exception-dry-run'));
    await waitFor(() => expect(screen.getByTestId('exception-replay')).not.toBeDisabled());
    expect(calls.find((call) => call.url.pathname.endsWith('/replays'))?.body).toEqual({ reason: 'unit bound', exceptionIds: ['e1'], dryRun: true });
    fireEvent.click(screen.getByTestId('exception-replay'));
    await waitFor(() => expect(screen.getByTestId('replay-run').getAttribute('data-dry-run')).toBe('false'));
    expect(calls.find((call) => call.url.pathname.endsWith('/resolve'))?.body).toEqual({ action: 'replay', reason: 'unit bound' });
  });

  describe('commands follow INTEGRATION_WRITERS (owner decision 2026-10-12)', () => {
    it('canWriteIntegration: an integration admin edits the connection; a production engineer only reads it', () => {
      reply = () => json(200, {});
      actAs('integration_admin');
      const admin = wrap(<ConnectionHeader connection={CONNECTION} />);
      expect(screen.getByTestId('connection-edit')).toBeTruthy();
      admin.unmount();
      actAs('production_engineer');
      wrap(<ConnectionHeader connection={CONNECTION} />);
      expect(screen.queryByTestId('connection-edit')).toBeNull();
      expect(screen.queryByTestId('connection-toggle')).toBeNull();
      expect(screen.getByTestId('connection-endpoint')).toBeTruthy();
    });
  });
});
