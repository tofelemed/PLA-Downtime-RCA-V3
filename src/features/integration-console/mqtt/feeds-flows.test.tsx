import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch, type V2Call } from '@/test/v2-fetch';
import { MQTT_CONNECTION } from './mqtt-test-fixtures';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { MqttWizardBody } = await import('./mqtt-wizard-body');
const { ProfileEditor } = await import('./profile-editor');
const { MqttConnectionPanel } = await import('./mqtt-connection-panel');

const UNITS = listPage([{ id: 'u1', code: 'EXT1', name: 'Extruder 1', siteId: null }]);
const PRODUCTS = listPage([{ id: 'p1', code: 'HD5502', name: 'HDPE film', uom: 't', isActive: true }]);
const masterData = (call: V2Call) => {
  if (call.url.pathname === '/api/v2/units') return jsonResponse(200, UNITS);
  if (call.url.pathname === '/api/v2/products') return jsonResponse(200, PRODUCTS);
  return undefined;
};

const FEEDS_CONNECTION: ConnectionView = {
  ...MQTT_CONNECTION,
  endpointConfig: {
    mqtt: { ...(MQTT_CONNECTION.endpointConfig.mqtt as Record<string, unknown>), topics: [] },
    payloadProfile: {
      kind: 'feeds',
      feeds: [
        { id: 'pla', purpose: 'pla', topic: 'marun/hdpe/pla', unitId: 'u1', productId: 'p1', fields: {} },
        { id: 'downtime', purpose: 'downtime', topic: 'marun/hdpe/downtime', durationUnit: 'min', fields: {} },
      ],
    },
  },
};

const show = (node: ReactNode, path = '/') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
  actAs('SuperAdmin');
});

describe('MQTT feeds (plans/MQTT_FEEDS.md)', () => {
  it('wizard: feeds is the default profile; the create body carries the feeds profile and no topic filters', async () => {
    const calls = stubV2Fetch((call) => masterData(call) ?? (call.method === 'POST' ? jsonResponse(201, FEEDS_CONNECTION) : undefined));
    const onSaved = vi.fn();
    show(<MqttWizardBody connection={null} onClose={() => undefined} onSaved={onSaved} />);
    expect(screen.getByTestId('mqtt-kind')).toHaveValue('feeds');
    const [plaCard, stopCard] = screen.getAllByTestId('feed-card');
    fireEvent.click(screen.getByTestId('mqtt-next'));
    expect(screen.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'profile');
    expect(within(plaCard).getByText('Enter the topic OT publishes on')).toBeInTheDocument();
    fireEvent.change(within(plaCard).getByTestId('feed-topic'), { target: { value: 'marun/hdpe/pla' } });
    await waitFor(() => expect(within(plaCard).getByRole('option', { name: 'EXT1 — Extruder 1' })).toBeInTheDocument());
    fireEvent.change(within(plaCard).getByTestId('feed-unit'), { target: { value: 'u1' } });
    await waitFor(() => expect(within(plaCard).getByRole('option', { name: 'HD5502 — HDPE film' })).toBeInTheDocument());
    fireEvent.change(within(plaCard).getByTestId('feed-product'), { target: { value: 'p1' } });
    fireEvent.change(within(plaCard).getByTestId('feed-field-actual'), { target: { value: 'production.good_t' } });
    fireEvent.change(within(stopCard).getByTestId('feed-topic'), { target: { value: 'marun/hdpe/downtime' } });
    fireEvent.click(screen.getByTestId('mqtt-next'));
    expect(screen.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'basics');
    expect(screen.queryByLabelText(/Topic filters/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Marun OT' } });
    fireEvent.change(screen.getByLabelText('Broker URL'), { target: { value: 'mqtt://broker:1883' } });
    fireEvent.click(screen.getByTestId('connection-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const create = calls.find((call) => call.method === 'POST');
    expect(create?.body).toEqual({
      sourceType: 'mqtt',
      displayName: 'Marun OT',
      isActive: true,
      endpointConfig: {
        mqtt: { brokerUrl: 'mqtt://broker:1883', protocolVersion: 5, qos: 1, cleanStart: false, sessionExpirySeconds: 86400, keepaliveSeconds: 60, connectTimeoutSeconds: 30, reconnect: { minSeconds: 1, maxSeconds: 60 }, tls: { mode: 'system' }, topics: [], maxMessageBytes: 65536 },
        payloadProfile: {
          kind: 'feeds',
          feeds: [
            { id: 'pla', purpose: 'pla', topic: 'marun/hdpe/pla', unitId: 'u1', productId: 'p1', fields: { actual: 'production.good_t' } },
            { id: 'downtime', purpose: 'downtime', topic: 'marun/hdpe/downtime', durationUnit: 'min', fields: {} },
          ],
        },
      },
    });
  });

  it('wizard: a 422 on a feed lands on the Profile step, on that feed', async () => {
    stubV2Fetch((call) => masterData(call) ?? (call.method === 'PATCH' ? jsonResponse(422, { code: 'INVALID_ENDPOINT_CONFIG', message: 'bad', correlationId: 'c', retryable: false, fieldErrors: [{ field: 'endpointConfig.payloadProfile.feeds[1].topic', message: 'overlaps another connection' }] }) : undefined));
    show(<MqttWizardBody connection={FEEDS_CONNECTION} onClose={() => undefined} onSaved={() => undefined} />, '/?step=basics');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByTestId('connection-save'));
    await waitFor(() => expect(screen.getByTestId('mqtt-wizard')).toHaveAttribute('data-step', 'profile'));
    expect(within(screen.getAllByTestId('feed-card')[1]).getByText('overlaps another connection')).toBeInTheDocument();
  });

  it('editor: add, change purpose (fields reset), reset mapping, remove; example payload for OT', () => {
    stubV2Fetch(masterData);
    show(<MqttWizardBody connection={null} onClose={() => undefined} onSaved={() => undefined} />);
    fireEvent.click(screen.getByTestId('feed-add-pla'));
    const cards = () => screen.getAllByTestId('feed-card');
    expect(cards()).toHaveLength(3);
    expect(cards()[2]).toHaveAttribute('data-feed-id', 'pla-2');
    fireEvent.change(within(cards()[2]).getByTestId('feed-field-actual'), { target: { value: 'x.y' } });
    fireEvent.click(within(cards()[2]).getByTestId('feed-mapping-reset'));
    expect(within(cards()[2]).getByTestId('feed-field-actual')).toHaveValue('production.actual_good_production_t');
    fireEvent.change(within(cards()[2]).getByTestId('feed-purpose'), { target: { value: 'downtime' } });
    expect(cards()[2]).toHaveAttribute('data-purpose', 'downtime');
    expect(within(cards()[2]).getByTestId('feed-field-start')).toHaveValue('start_time');
    expect(within(cards()[2]).queryByTestId('feed-unit')).toBeNull();
    expect(within(cards()[2]).getByTestId('feed-example-json')).toHaveTextContent('"duration_min": 35');
    expect(within(cards()[0]).getByTestId('feed-example-json')).toHaveTextContent('"actual_good_production_t": 208');
    expect(within(cards()[0]).getByTestId('feed-topic')).toHaveAttribute('placeholder', 'marun/hdpe/pla');
    fireEvent.click(within(cards()[2]).getByTestId('feed-remove'));
    expect(cards()).toHaveLength(2);
  });

  it('payload profile tab: a feeds connection saves { payloadProfilePatch: { feeds } } under If-Match; non-writers read only', async () => {
    const calls = stubV2Fetch((call) => masterData(call) ?? (call.method === 'PATCH' ? jsonResponse(200, { ...FEEDS_CONNECTION, rowVersion: 2 }) : undefined));
    const view = show(<ProfileEditor connection={FEEDS_CONNECTION} />);
    expect(screen.getByTestId('profile-editor')).toHaveAttribute('data-kind', 'feeds');
    const stopCard = screen.getAllByTestId('feed-card')[1];
    fireEvent.change(within(stopCard).getByTestId('feed-duration-unit'), { target: { value: 's' } });
    fireEvent.change(within(stopCard).getByTestId('feed-field-reason'), { target: { value: 'reason.code' } });
    fireEvent.click(screen.getByTestId('profile-save'));
    await waitFor(() => expect(screen.getByTestId('profile-saved')).toBeInTheDocument());
    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch?.url.pathname).toBe('/api/v2/connections/c1');
    expect(patch?.headers.get('If-Match')).toBe('"1"');
    expect(patch?.body).toEqual({
      payloadProfilePatch: {
        feeds: [
          { id: 'pla', purpose: 'pla', topic: 'marun/hdpe/pla', unitId: 'u1', productId: 'p1', fields: {} },
          { id: 'downtime', purpose: 'downtime', topic: 'marun/hdpe/downtime', durationUnit: 's', fields: { reason: 'reason.code' } },
        ],
      },
    });
    view.unmount();
    actAs('production_engineer');
    show(<ProfileEditor connection={FEEDS_CONNECTION} />);
    expect(screen.queryByTestId('profile-save')).toBeNull();
    expect(screen.queryByTestId('feed-add-pla')).toBeNull();
    expect(screen.getAllByTestId('feed-topic')[0]).toHaveAttribute('readonly');
  });

  it('Production loss events tab links to the Event Hub list of the PLA feed unit', async () => {
    stubV2Fetch(() => undefined);
    show(<MqttConnectionPanel connection={FEEDS_CONNECTION} timezone="Asia/Tehran" />, '/?tab=production-loss-events');
    const link = await screen.findByTestId('production-loss-events-link');
    const href = link.getAttribute('href') ?? '';
    expect(href).toMatch(/^\/events\?/);
    expect(new URLSearchParams(href.split('?')[1]).get('kinds')).toBe('production_loss');
    expect(screen.getByText(/becomes a production loss event in the Event Hub/i)).toBeInTheDocument();
  });

  it('Production loss events tab: no tab without a PLA feed', () => {
    stubV2Fetch(() => undefined);
    show(<MqttConnectionPanel connection={MQTT_CONNECTION} timezone="Asia/Tehran" />);
    expect(screen.queryByTestId('tab-production-loss-events')).toBeNull();
  });
});
