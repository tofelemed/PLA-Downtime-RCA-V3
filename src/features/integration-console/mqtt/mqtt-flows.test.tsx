import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { MQTT_CONNECTION as CONNECTION } from './mqtt-test-fixtures';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { MqttWizardBody } = await import('./mqtt-wizard-body');
const { ProfileEditor } = await import('./profile-editor');

interface Call {
  method: string;
  url: URL;
  headers: Headers;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const SECRET = 'typed-once-mqtt-secret';



describe('MQTT console flows (plan 1.8 step 5)', () => {
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
  afterEach(() => vi.unstubAllGlobals());

  it('wizard: next stops on the owning step, the create body is the exact endpoint_config shape, the password travels once', async () => {
    reply = () => json(201, CONNECTION);
    const onSaved = vi.fn();
    wrap(<MqttWizardBody connection={null} onClose={() => undefined} onSaved={onSaved} />);
    expect(screen.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'profile');
    fireEvent.change(screen.getByTestId('mqtt-kind'), { target: { value: 'interval_event_json' } });
    fireEvent.click(screen.getByTestId('mqtt-next'));
    expect(screen.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'basics');
    fireEvent.click(screen.getByTestId('mqtt-next'));
    expect(screen.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'basics');
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Lab' } });
    fireEvent.change(screen.getByLabelText('Broker URL'), { target: { value: 'mqtt://mqtt:1883' } });
    fireEvent.click(screen.getByTestId('mqtt-next'));
    expect(screen.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'connection');
    expect(screen.getByTestId('mqtt-tls-off')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('User name'), { target: { value: 'lab' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: SECRET } });
    fireEvent.click(screen.getByTestId('connection-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const create = calls.find((call) => call.method === 'POST');
    expect(create?.url.pathname).toBe('/api/v2/connections');
    expect(create?.headers.get('Idempotency-Key')).toBeTruthy();
    expect(create?.body).toEqual({
      sourceType: 'mqtt',
      displayName: 'Lab',
      isActive: true,
      secret: SECRET,
      endpointConfig: {
        mqtt: { brokerUrl: 'mqtt://mqtt:1883', protocolVersion: 5, username: 'lab', qos: 1, cleanStart: false, sessionExpirySeconds: 86400, keepaliveSeconds: 60, connectTimeoutSeconds: 30, reconnect: { minSeconds: 1, maxSeconds: 60 }, tls: { mode: 'system' }, topics: ['proact/v1/+/+/+/+/events'], maxMessageBytes: 65536 },
        payloadProfile: { kind: 'interval_event_json', schemaVersion: '1.0', topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/events', identityStrategy: 'event_id', time: { unit: 'iso', maxFutureSkewSeconds: 300, maxPastSeconds: 604800 }, quality: { protocol: 'PI' } },
      },
    });
    expect(JSON.stringify(create?.body.endpointConfig)).not.toContain(SECRET);
  });

  it('wizard: a 422 with field errors lands on the owning step with the message inline', async () => {
    reply = () => json(422, { code: 'INVALID_ENDPOINT_CONFIG', message: 'bad', correlationId: 'corr-2', retryable: false, fieldErrors: [{ field: 'endpointConfig.mqtt.keepaliveSeconds', message: 'must be an integer between 1 and 65535' }] });
    wrap(<MqttWizardBody connection={null} onClose={() => undefined} onSaved={() => undefined} />);
    fireEvent.change(screen.getByTestId('mqtt-kind'), { target: { value: 'interval_event_json' } });
    fireEvent.click(screen.getByTestId('mqtt-next'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Lab' } });
    fireEvent.change(screen.getByLabelText('Broker URL'), { target: { value: 'mqtt://mqtt:1883' } });
    fireEvent.click(screen.getByTestId('connection-save'));
    await waitFor(() => expect(screen.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'advanced'));
    expect(screen.getByText('must be an integer between 1 and 65535')).toBeInTheDocument();
    expect(screen.getByTestId('refusal')).toHaveAttribute('data-code', 'INVALID_ENDPOINT_CONFIG');
  });

  it('profile editor: live classification, the state map must keep running/stopped, the save is a merge patch under If-Match', async () => {
    reply = () => json(200, { ...CONNECTION, rowVersion: 2, configVersion: 2 });
    wrap(<ProfileEditor connection={CONNECTION} />);
    fireEvent.click(screen.getByRole('button', { name: /Value maps/ }));
    fireEvent.click(screen.getByTestId('state-map-add'));
    const row = screen.getByTestId('state-map-row');
    fireEvent.change(row.querySelector('input[aria-label="Raw token"]') as HTMLInputElement, { target: { value: 'RUN' } });
    fireEvent.change(row.querySelector('input[aria-label="DT01 state"]') as HTMLInputElement, { target: { value: 'idle' } });
    expect(screen.getByTestId('state-map-error')).toHaveTextContent(/running or stopped/);
    expect(screen.getByTestId('profile-save')).toBeDisabled();
    fireEvent.change(row.querySelector('input[aria-label="DT01 state"]') as HTMLInputElement, { target: { value: 'running' } });
    expect(screen.queryByTestId('state-map-error')).toBeNull();
    fireEvent.change(screen.getByLabelText('Try a raw token', { selector: '#state-probe-input' }), { target: { value: 'run' } });
    expect(screen.getByTestId('state-probe-result')).toHaveTextContent('"run" → running (matched case-insensitively)');
    fireEvent.change(screen.getByLabelText('Try a raw token', { selector: '#state-probe-input' }), { target: { value: 'STOP' } });
    expect(screen.getByTestId('state-probe-result')).toHaveTextContent(/unmapped_value/);
    fireEvent.click(screen.getByTestId('profile-save'));
    await waitFor(() => expect(screen.getByTestId('profile-saved')).toBeInTheDocument());
    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch?.url.pathname).toBe('/api/v2/connections/c1');
    expect(patch?.headers.get('If-Match')).toBe('"1"');
    expect(patch?.body).toEqual({ payloadProfilePatch: { valueMaps: { state: { RUN: 'running' } } } });
  });
});
