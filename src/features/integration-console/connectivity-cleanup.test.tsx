import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ConnectionView, IngestionExceptionDetailView, IngestionJobView } from '@/api/v2/types/integrations';
import type { SignalView } from '@/api/v2/types/integration-mappings';
import type { MqttHealthView } from './mqtt/model/mqtt-health';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'tenant', loading: false }) }));

const { ConsolePage } = await import('./pages/console-page');
const { ConnectionEditorPage } = await import('./pages/connection-editor-page');
const { DiagnosticsPanel } = await import('./connections/diagnostics-panel');
const { ConnectionHeader } = await import('./connections/connection-header');
const { BindSourceDialog } = await import('./mapping/bind-source-dialog');
const { ExceptionActions } = await import('./quarantine/exception-actions');
const { MqttWizardBody } = await import('./mqtt/mqtt-wizard-body');
const { MqttTestPanel } = await import('./mqtt/mqtt-test-panel');
const { JobRow } = await import('./jobs/job-row');
const { SignalsPanel } = await import('./signals/signals-panel');
const { SubscriptionCounters } = await import('./mqtt/subscription-counters');
const { SignalPicker } = await import('./historian/signal-picker');

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const EMPTY = { items: [], nextCursor: null };

const CONNECTION: ConnectionView = {
  id: 'c1', sourceType: 'pi_web_api', displayName: 'PI sim', endpointConfig: { piWebApiUrl: 'http://127.0.0.1:9/piwebapi' }, hasSecret: true, effectiveClientId: null,
  capabilities: {}, configVersion: 1, isActive: true, rowVersion: 1, createdAt: '2026-10-10T00:00:00Z', updatedAt: null,
};

describe('Connectivity cleanup (25 Oct 2026)', () => {
  let client: QueryClient;
  const wrap = (node: ReactNode, path = '/connectivity') =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <QueryClientProvider client={client}>{node}</QueryClientProvider>
      </MemoryRouter>,
    );

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async () => json(200, EMPTY)));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('header: no description or "Times in" line; New connection stays; Connections is a report card with ⓘ and an h-9 toggle', async () => {
    wrap(<ConsolePage />);
    expect(screen.getByRole('heading', { name: 'Connectivity', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText(/Connections to plant sources/)).toBeNull();
    expect(screen.queryByText(/Times in/)).toBeNull();
    expect(screen.getByTestId('new-connection')).toBeInTheDocument();
    const card = screen.getByRole('region', { name: 'Connections' });
    expect(card.className).toContain('bg-card');
    expect(within(card).getByRole('button', { name: 'About Connections' })).toBeInTheDocument();
    expect(within(card).getByLabelText('Show inactive').parentElement?.className).toContain('h-9');
    expect(await within(card).findByText('No active connections')).toBeInTheDocument();
    expect(within(card).getByText('Turn on Show inactive, or create one with New connection.')).toBeInTheDocument();
    fireEvent.click(within(card).getByLabelText('Show inactive'));
    expect(await within(card).findByText('No connections yet')).toBeInTheDocument();
    expect(within(card).getByText('Create one with New connection.')).toBeInTheDocument();
    expect(screen.queryByText('No data for these dates')).toBeNull();
  });

  it('quarantine tab: Connection, Problem, State labelled above h-9 selects on one row; Refresh at the card title; own empty message', async () => {
    wrap(<ConsolePage />, '/connectivity?tab=quarantine');
    const card = screen.getByRole('region', { name: 'Quarantined items' });
    expect(within(card).getByTestId('quarantine-refresh')).toBeInTheDocument();
    const bar = within(card).getByTestId('quarantine-filters');
    expect(bar.className).toContain('items-end');
    const labels = within(bar).getAllByText(/^(Connection|Problem|State)$/).map((label) => label.textContent);
    expect(labels).toEqual(['Connection', 'Problem', 'State']);
    for (const label of labels) expect(within(bar).getByLabelText(label as string).className).toContain('h-9');
    expect(await within(card).findByText('Nothing is waiting for these filters.')).toBeInTheDocument();
  });

  it('mappings tab: a visible Match label, Show inactive, New mapping at the card title', async () => {
    wrap(<ConsolePage />, '/connectivity?tab=mappings');
    const card = screen.getByRole('region', { name: 'Source mappings' });
    expect(within(card).getByLabelText('Match').className).toContain('h-9');
    expect(within(card).getByLabelText('Show inactive')).toBeInTheDocument();
    expect(within(card).getByTestId('new-mapping')).toBeInTheDocument();
    expect(await within(card).findByText('No mapping rules')).toBeInTheDocument();
    expect(within(card).getByText('Bind a source from the quarantine, or add one with New mapping.')).toBeInTheDocument();
    fireEvent.change(within(card).getByLabelText('Match'), { target: { value: 'pattern' } });
    expect(await within(card).findByText('No mapping rules match these filters.')).toBeInTheDocument();
  });

  it('the connection editor page has no description paragraph (the password field says how it is stored)', () => {
    wrap(<ConnectionEditorPage />, '/connectivity/connections/new');
    expect(screen.getByRole('heading', { name: 'New connection', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText(/Endpoint settings are stored with the connection/)).toBeNull();
  });

  it('diagnostics: the accounting caution moves behind ⓘ; Run diagnostics stays', () => {
    wrap(<DiagnosticsPanel connection={CONNECTION} last={null} timezone="UTC" onTested={() => undefined} />);
    expect(screen.queryByText(/A reachable source does not mean accounting works/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About Diagnostics' })).toBeInTheDocument();
    expect(screen.getByTestId('run-diagnostics')).toBeInTheDocument();
  });

  it('signals: the empty text is a next step, not the title again', async () => {
    wrap(<SignalsPanel connectionId="c1" timezone="UTC" />);
    expect(await screen.findByText('Define the measurements this connection delivers.')).toBeInTheDocument();
    expect(screen.queryByText('No signals defined yet.')).toBeNull();
  });

  it('MQTT counters: the note is announced once (the ⓘ), not also as a hidden description', () => {
    const counters = { received: 1, accepted: 1, duplicate: 0, stale: 0, conflict: 0, quarantined: 0, parked: 0 };
    wrap(<SubscriptionCounters health={{ counters } as unknown as MqttHealthView} />);
    expect(screen.getByRole('button', { name: 'About Counters' })).toBeInTheDocument();
    expect(screen.queryByText(/Counted since the worker last started/)).toBeNull();
    expect(screen.getByTestId('mqtt-counters').getAttribute('aria-describedby')).toBeNull();
  });

  it('historian picker: the full-trend reason sits under Add to trend, in the same column', () => {
    const signals = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: `S-${id}`, effectiveTo: null }) as unknown as SignalView);
    wrap(<div data-testid="row"><SignalPicker catalog={signals} chosenIds={signals.map((s) => s.id)} isLoading={false} onChange={() => undefined} /></div>);
    const add = screen.getByTestId('trend-add');
    const reason = screen.getByTestId('disabled-reason');
    expect(add.getAttribute('aria-describedby')).toBe(reason.id);
    expect(reason.parentElement).toBe(add.parentElement);
    expect(add.parentElement?.className).toContain('flex-col');
  });

  it('MQTT connection test: the CONNACK note moves behind ⓘ', () => {
    wrap(<MqttTestPanel connection={{ ...CONNECTION, sourceType: 'mqtt' }} last={null} timezone="UTC" onTested={() => undefined} />);
    expect(screen.queryByText(/A CONNACK proves the broker/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About Connection test' })).toBeInTheDocument();
  });
});

describe('Connectivity dialogs and wizard steps open and close', () => {
  let client: QueryClient;
  const wrap = (node: ReactNode) =>
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>{node}</QueryClientProvider>
      </MemoryRouter>,
    );

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async () => json(200, EMPTY)));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  const buttonsOf = (dialog: HTMLElement) => within(dialog).getAllByRole('button').map((button) => button.textContent?.trim()).filter(Boolean);

  it('Deactivate: a 420 px confirm in sentence case, Cancel before the action, Esc closes', async () => {
    wrap(<ConnectionHeader connection={CONNECTION} />);
    fireEvent.click(screen.getByTestId('connection-toggle'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Deactivate PI sim?')).toBeInTheDocument();
    expect(dialog.className).toContain('sm:max-w-[420px]');
    expect(buttonsOf(dialog)).toEqual(['Cancel', 'Deactivate']);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('Job command: opened from a job row, 560 px, Cancel before the action', async () => {
    const job = {
      id: 'j1', connectionId: 'c1', scope: { mode: 'window', purpose: 'limited' }, state: 'running', leaseOwner: null, leaseExpiry: null, heartbeatAt: null,
      committedCursor: null, lastObservationAt: null, lastSuccessAt: null, retryCount: 0, lastError: null,
      cadence: { intervalSeconds: 60, pageSize: 50 }, nextRunAt: null, health: {}, rowVersion: 1, createdAt: null, updatedAt: null,
    } as IngestionJobView;
    wrap(<JobRow job={job} timezone="UTC" now={Date.parse('2026-10-10T08:00:00Z')} />);
    fireEvent.click(screen.getByTestId('job-stop'));
    const dialog = await screen.findByTestId('job-command-dialog');
    expect(dialog.className).toContain('sm:max-w-[560px]');
    const buttons = buttonsOf(dialog).filter((label) => label !== 'Close');
    expect(buttons.indexOf('Cancel')).toBe(buttons.length - 2);
    expect(within(dialog).getByTestId('job-command-confirm')).toBe(within(dialog).getAllByRole('button').filter((b) => b.textContent?.trim() !== 'Close').at(-1));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('job-command-dialog')).toBeNull());
  });

  it('Bind source: 560 px, Unit labelled above its select, Cancel then Bind, Esc closes', async () => {
    const onClose = vi.fn();
    wrap(<BindSourceDialog connectionId="c1" target={{ matchKind: 'exact_path', matchValue: '\\\\AF\\HDPE\\Extruder1' }} onClose={onClose} onBound={() => undefined} />);
    const dialog = await screen.findByTestId('bind-source-dialog');
    expect(dialog.className).toContain('sm:max-w-[560px]');
    expect(within(dialog).getByRole('heading', { name: 'Bind source to a unit' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Unit').className).toContain('h-9');
    const footer = buttonsOf(dialog).slice(-3);
    expect(footer.slice(0, 2)).toEqual(['Cancel', 'Bind']);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('Mark irrecoverable: needs the reason first, then confirms in a 420 px dialog', async () => {
    const exception = { id: 'e1', connectionId: 'c1', sourceObjectId: 'EF-1', rawId: 'r', errorCode: 'unknown_unit', detail: null, state: 'open', ownerId: null, firstSeen: null, lastSeen: null, occurrences: 1, resolution: null, replayRunId: null, rowVersion: 1, raw: null } as IngestionExceptionDetailView;
    wrap(<ExceptionActions exception={exception} />);
    expect(screen.getByTestId('exception-irrecoverable')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reason (audited, required)'), { target: { value: 'source deleted' } });
    fireEvent.click(screen.getByTestId('exception-irrecoverable'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Close this item as irrecoverable?')).toBeInTheDocument();
    expect(buttonsOf(dialog)).toEqual(['Cancel', 'Mark irrecoverable']);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('MQTT wizard: every step opens from the step list with its first field', () => {
    wrap(<MqttWizardBody connection={null} onClose={() => undefined} onSaved={() => undefined} />);
    const steps: Array<[string, string]> = [
      ['profile', 'Payload profile'],
      ['basics', 'Broker URL'],
      ['connection', 'Protocol version'],
      ['advanced', 'QoS'],
    ];
    for (const [step, field] of steps) {
      fireEvent.click(screen.getByTestId(`mqtt-step-${step}`));
      expect(screen.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', step);
      expect(screen.getByLabelText(field)).toBeInTheDocument();
    }
    // the last step: Cancel, Back, then the primary action on the right
    expect(screen.getAllByRole('button').map((button) => button.textContent).slice(-3)).toEqual(['Cancel', 'Back', 'Create connection']);
  });
});
