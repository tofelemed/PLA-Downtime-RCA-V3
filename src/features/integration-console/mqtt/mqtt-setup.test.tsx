import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { jsonResponse, stubV2Fetch } from '@/test/v2-fetch';
import { MQTT_CONNECTION } from './mqtt-test-fixtures';
import { MqttConnectionPanel } from './mqtt-connection-panel';
import { MqttSamplePreview } from './mqtt-sample-preview';
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/date-inputs', async (original) => ({ ...(await original<Record<string, unknown>>()), DateTimeInput: ({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string) => void }) => <label>{label}<input value={value ?? ''} onChange={(e) => onChange(e.target.value)} /></label> }));
const show = (element: React.ReactNode, path = '/') => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter initialEntries={[path]}>{element}</MemoryRouter></QueryClientProvider>);
afterEach(() => { vi.unstubAllGlobals(); actAs('SuperAdmin'); });
describe('MQTT setup navigation and sample validation', () => {
  it('exposes Define signal on the MQTT Signals tab and does not write on render', async () => {
    const calls = stubV2Fetch(() => undefined); actAs('SuperAdmin');
    show(<MqttConnectionPanel connection={MQTT_CONNECTION} timezone="Asia/Dubai" />, '/connectivity/connections/c1?tab=signals');
    expect(await screen.findByRole('link', { name: 'Define signal' })).toHaveAttribute('href', '/connectivity/connections/c1/signals/new');
    expect(screen.getByRole('tab', { name: 'Setup readiness' })).toBeInTheDocument();
    expect(calls.some((call) => call.method !== 'GET')).toBe(false);
  });
  it('sends the entered packet to a read-only validation endpoint and displays an unknown binding honestly', async () => {
    const calls = stubV2Fetch(() => jsonResponse(200, { ok: true, kind: 'measurement', sourceKey: 'EXT1-Total', bindingStatus: 'unknown_signal_or_out_of_scope', binding: null }));
    show(<MqttSamplePreview connectionId="c1" timezone="Asia/Dubai" />);
    const validate = screen.getByRole('button', { name: 'Validate sample (no writes)' });
    expect(validate).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'source/topic' } });
    fireEvent.change(screen.getByLabelText('Payload JSON'), { target: { value: '{"signal":"EXT1-Total"}' } });
    fireEvent.change(screen.getByLabelText('Sample receive time'), { target: { value: '2026-10-17T02:01:00Z' } });
    fireEvent.click(validate);
    await waitFor(() => expect(screen.getByText(/Decoded measurement: unknown signal or out of scope/)).toBeInTheDocument());
    expect(calls).toHaveLength(1);
    expect(calls[0].url.pathname).toBe('/api/v2/connections/c1/mqtt-preview');
    expect(calls[0].body).toEqual({ topic: 'source/topic', payload: '{"signal":"EXT1-Total"}', receivedAt: '2026-10-17T02:01:00Z', retained: false });
    expect(screen.getByText(/does not prove live delivery/)).toBeInTheDocument();
  });
});
