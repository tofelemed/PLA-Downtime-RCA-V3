import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { actAs } from '@/test/acting-user';
import { MQTT_CONNECTION } from './mqtt-test-fixtures';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
const { ProfileEditor } = await import('./profile-editor');

interface Call { method: string; url: URL; headers: Headers; body: unknown }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const section = (name: string) => screen.getByRole('button', { name: new RegExp(name) });
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const profileOf = (connection: ConnectionView) => connection.endpointConfig.payloadProfile as Record<string, unknown>;

describe('MQTT profile disclosure layout', () => {
  let client: QueryClient;
  let calls: Call[];
  let reply: (call: Call) => Response | Promise<Response>;
  const wrap = (node: ReactNode) => <MemoryRouter><QueryClientProvider client={client}>{node}</QueryClientProvider></MemoryRouter>;

  beforeEach(() => {
    actAs('SuperAdmin');
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    calls = [];
    reply = () => json(200, MQTT_CONNECTION);
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call: Call = { method: init.method ?? 'GET', url: new URL(url), headers: new Headers(init.headers), body: init.body ? JSON.parse(String(init.body)) as unknown : null };
      calls.push(call);
      return reply(call);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => { client.clear(); vi.unstubAllGlobals(); actAs('SuperAdmin'); });

  it('starts with one clear save/status area, identity open, and secondary sections collapsed without requests', () => {
    render(wrap(<ProfileEditor connection={MQTT_CONNECTION} />));
    expect(section('Identity and schema')).toHaveAttribute('aria-expanded', 'true');
    for (const title of ['Time and quality', 'Field overrides', 'Value maps']) expect(section(title)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Max age (s)')).not.toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Save profile' })).toHaveLength(1);
    expect(screen.getByTestId('profile-save')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('No unsaved changes');
    expect(calls).toEqual([]);
  });

  it('retains edits and probes across disclosures and sends one exact versioned merge patch', async () => {
    const saved: ConnectionView = { ...MQTT_CONNECTION, rowVersion: 2, configVersion: 2, endpointConfig: { ...MQTT_CONNECTION.endpointConfig, payloadProfile: { ...profileOf(MQTT_CONNECTION), schemaVersion: '2.0', time: { unit: 'iso', maxFutureSkewSeconds: 300, maxPastSeconds: 3600 }, fields: { eventId: 'event.key' }, valueMaps: { state: { RUN: 'running' } } } } };
    reply = () => json(200, saved);
    const view = render(wrap(<ProfileEditor connection={MQTT_CONNECTION} />));
    change('Schema version', '2.0');
    fireEvent.click(section('Time and quality'));
    change('Max age (s)', '3600');
    fireEvent.click(section('Time and quality'));
    fireEvent.click(section('Field overrides'));
    fireEvent.click(screen.getByTestId('profile-field-add'));
    change('Field', 'eventId');
    change('JSON path', 'event.key');
    fireEvent.click(section('Field overrides'));
    fireEvent.click(section('Value maps'));
    fireEvent.click(screen.getByTestId('state-map-add'));
    const map = within(screen.getByTestId('value-map-state'));
    fireEvent.change(map.getByLabelText('Raw token'), { target: { value: 'RUN' } });
    fireEvent.change(map.getByLabelText('DT01 state'), { target: { value: 'running' } });
    fireEvent.change(map.getByLabelText('Try a raw token'), { target: { value: 'run' } });
    fireEvent.click(section('Value maps'));
    expect(map.getByTestId('state-probe-result')).not.toBeVisible();
    fireEvent.click(section('Value maps'));
    expect(map.getByTestId('state-probe-result')).toHaveTextContent('"run" → running');
    expect(screen.getByLabelText('Max age (s)')).toHaveValue('3600');
    expect(screen.getByLabelText('JSON path')).toHaveValue('event.key');
    fireEvent.click(screen.getByTestId('profile-save'));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url.pathname).toBe('/api/v2/connections/c1');
    expect(calls[0].headers.get('If-Match')).toBe('"1"');
    expect(calls[0].body).toEqual({ payloadProfilePatch: { schemaVersion: '2.0', fields: { eventId: 'event.key' }, time: { maxPastSeconds: 3600 }, valueMaps: { state: { RUN: 'running' } } } });
    view.rerender(wrap(<ProfileEditor connection={saved} />));
    await waitFor(() => expect(screen.getByTestId('profile-saved')).toBeVisible());
    change('Schema version', '2.1');
    expect(screen.queryByTestId('profile-saved')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
  });

  it('reveals a hidden local error and associates its message with the invalid control', async () => {
    const invalid: ConnectionView = { ...MQTT_CONNECTION, endpointConfig: { ...MQTT_CONNECTION.endpointConfig, payloadProfile: { ...profileOf(MQTT_CONNECTION), time: { unit: 'iso', maxPastSeconds: -1 } } } };
    render(wrap(<ProfileEditor connection={invalid} />));
    await waitFor(() => expect(section('Time and quality')).toHaveAttribute('aria-expanded', 'true'));
    const input = screen.getByLabelText('Max age (s)');
    expect(input).toBeVisible();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'pp-past-error');
    expect(screen.getByTestId('profile-save')).toBeDisabled();
    expect(calls).toEqual([]);
  });

  it('reveals the owning sections for server field errors while retaining the complete draft', async () => {
    reply = () => json(422, { code: 'INVALID_ENDPOINT_CONFIG', message: 'Profile validation failed', correlationId: 'profile-fields', retryable: false, fieldErrors: [
      { field: 'endpointConfig.payloadProfile.time.maxPastSeconds', message: 'Server age validation' },
      { field: 'endpointConfig.payloadProfile.fields.eventId', message: 'Server path validation' },
      { field: 'endpointConfig.payloadProfile.valueMaps.state.RUN', message: 'Server state validation' },
    ] });
    render(wrap(<ProfileEditor connection={MQTT_CONNECTION} />));
    change('Schema version', '2.0');
    fireEvent.click(screen.getByTestId('profile-save'));
    await waitFor(() => expect(section('Time and quality')).toHaveAttribute('aria-expanded', 'true'));
    for (const name of ['Field overrides', 'Value maps']) expect(section(name)).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Schema version')).toHaveValue('2.0');
    expect(screen.getByLabelText('Max age (s)')).toHaveAttribute('aria-describedby', 'pp-past-error');
    expect(within(screen.getByTestId('profile-section-fields')).getByText('Server path validation')).toBeVisible();
    expect(screen.getByTestId('state-map-error')).toHaveTextContent('Server state validation');
    expect(calls).toHaveLength(1);
  });

  it('preserves a collapsed draft after a stale revision refusal and never retries automatically', async () => {
    reply = () => json(412, { code: 'STALE_REVISION', message: 'The current revision is 2', correlationId: 'stale-profile', retryable: false });
    render(wrap(<ProfileEditor connection={MQTT_CONNECTION} />));
    change('Schema version', '2.0');
    fireEvent.click(section('Identity and schema'));
    fireEvent.click(screen.getByTestId('profile-save'));
    await waitFor(() => expect(screen.getByTestId('refusal')).toHaveAttribute('data-code', 'STALE_REVISION'));
    expect(screen.getByLabelText('Schema version')).toHaveValue('2.0');
    expect(screen.getByTestId('profile-editor')).toHaveAttribute('data-dirty', 'true');
    expect(calls).toHaveLength(1);
  });

  it('discards all section edits together without a request', () => {
    render(wrap(<ProfileEditor connection={MQTT_CONNECTION} />));
    change('Schema version', '2.0');
    fireEvent.click(section('Time and quality'));
    change('Max age (s)', '120');
    fireEvent.click(section('Time and quality'));
    fireEvent.click(screen.getByTestId('profile-reset'));
    expect(screen.getByLabelText('Schema version')).toHaveValue('1.0');
    expect(screen.getByLabelText('Max age (s)')).toHaveValue('604800');
    expect(screen.getByTestId('profile-editor')).toHaveAttribute('data-dirty', 'false');
    expect(calls).toEqual([]);
  });

  it('announces pending save and prevents duplicate submission', async () => {
    let finish: ((response: Response) => void) | undefined;
    reply = () => new Promise<Response>((resolve) => { finish = resolve; });
    render(wrap(<ProfileEditor connection={MQTT_CONNECTION} />));
    change('Schema version', '2.0');
    fireEvent.click(screen.getByTestId('profile-save'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saving profile'));
    expect(screen.getByTestId('profile-save')).toBeDisabled();
    fireEvent.click(screen.getByTestId('profile-save'));
    expect(calls).toHaveLength(1);
    finish?.(json(200, MQTT_CONNECTION));
    await waitFor(() => expect(screen.getByTestId('profile-saved')).toBeVisible());
  });

  it('keeps the write capability gate on the single save control', () => {
    actAs('viewer');
    render(wrap(<ProfileEditor connection={MQTT_CONNECTION} />));
    expect(screen.queryByTestId('profile-save')).toBeNull();
    fireEvent.click(section('Value maps'));
    expect(screen.getByTestId('value-map-state')).toBeVisible();
    expect(calls).toEqual([]);
  });
});
