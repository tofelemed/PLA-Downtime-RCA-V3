import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { IngestionJobView } from '@/api/v2/types/integrations';
import type { MqttSubscription } from './hooks/use-mqtt-subscription';
import { mqttHealthOf, subscriptionStatus } from './model/mqtt-health';
import { MQTT_CONNECTION } from './mqtt-test-fixtures';
import { SubscriptionCounters } from './subscription-counters';
import { SubscriptionStatus } from './subscription-status';

const NOW = Date.parse('2026-10-11T08:00:00Z');
const JOB: IngestionJobView = {
  id: 'j1', connectionId: 'c1', scope: { mode: 'subscribe' }, state: 'running', leaseOwner: 'worker-1', leaseExpiry: '2026-10-11T08:01:00Z', heartbeatAt: '2026-10-11T07:59:50Z',
  committedCursor: null, lastObservationAt: '2026-10-11T07:59:49Z', lastSuccessAt: null, retryCount: 0, lastError: null, cadence: null, nextRunAt: null, health: {}, rowVersion: 1, createdAt: '2026-10-11T07:00:00Z', updatedAt: null,
};

function subscription(patch: Record<string, unknown> = {}, job: IngestionJobView | null = JOB): MqttSubscription {
  const health = mqttHealthOf({ connected: true, configVersion: 1, sourceAvailable: true, effectiveClientId: 'proact-c1', sessionPresent: true, reconnects: 2, lastMessageAt: '2026-10-11T07:59:49Z', lastPersistAt: '2026-10-11T07:59:50Z', subscribedTopics: ['proact/v1/+/+/+/+/events'], counters: { received: 10, accepted: 7, duplicate: 1, stale: 1, conflict: 1, quarantined: 2, parked: 3 }, ...patch });
  return { job, health, now: NOW, status: subscriptionStatus(job, health, NOW), isLoading: false, isError: false, error: null };
}

describe('MQTT subscription health presentation', () => {
  it('keeps health, observation and operational facts visible with technical details collapsed', () => {
    render(<SubscriptionStatus connection={MQTT_CONNECTION} subscription={subscription()} timezone="Asia/Tehran" />);
    expect(screen.getByTestId('mqtt-status-badge')).toHaveTextContent('Connected');
    expect(screen.getByTestId('mqtt-source-available')).toBeVisible();
    for (const label of ['Last observation', 'Last message', 'Last persist', 'Heartbeat', 'In flight', 'Reconnects']) expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByTestId('mqtt-technical-details')).not.toHaveAttribute('open');
    expect(screen.getByTestId('mqtt-client-id')).not.toBeVisible();
    expect(screen.getByText('Session present on last connect')).not.toBeVisible();
  });

  it('keeps persistence failures and source unavailability prominent, never reporting healthy', () => {
    render(<SubscriptionStatus connection={MQTT_CONNECTION} subscription={subscription({ sourceAvailable: false, persistFailed: { at: '2026-10-11T07:59:45Z', error: 'Database write unavailable' } })} timezone="Asia/Tehran" />);
    expect(screen.getByTestId('mqtt-status')).toHaveAttribute('data-status', 'persist_failed');
    expect(screen.getByTestId('mqtt-status-badge')).toHaveTextContent('Receiving but cannot persist');
    expect(screen.getByTestId('mqtt-persist-failure')).toBeVisible();
    expect(screen.getByTestId('mqtt-persist-failure')).toHaveTextContent('Database write unavailable');
    expect(screen.getByTestId('mqtt-source-available')).toHaveTextContent('unavailable');
    expect(screen.getByTestId('mqtt-technical-details')).not.toHaveAttribute('open');
  });

  it('reveals every technical fact on request and preserves all seven counters', () => {
    const current = subscription({ lastAvailabilityAt: '2026-10-11T07:59:00Z' });
    render(<><SubscriptionStatus connection={MQTT_CONNECTION} subscription={current} timezone="Asia/Tehran" /><SubscriptionCounters health={current.health} /></>);
    fireEvent.click(screen.getByText('Technical connection details'));
    const details = screen.getByTestId('mqtt-technical-details');
    expect(details).toHaveAttribute('open');
    expect(screen.getByTestId('mqtt-client-id')).toHaveTextContent('proact-c1');
    for (const label of ['Effective client id', 'Session present on last connect', 'Lease', 'Subscribed filters', 'Last availability message']) expect(within(details).getByText(label)).toBeVisible();
    expect(details).toHaveTextContent('worker-1 until 2026-10-11T08:01:00Z');
    expect(details).toHaveTextContent('proact/v1/+/+/+/+/events');
    for (const [key, value] of Object.entries(current.health.counters)) expect(screen.getByTestId('mqtt-counters').querySelector(`[data-counter="${key}"] dd`)).toHaveTextContent(String(value));
    expect(screen.getByTestId('mqtt-counters').querySelectorAll('dt')).toHaveLength(7);
  });

  it('retains the existing no-job and pending-restart states', () => {
    const view = render(<SubscriptionStatus connection={MQTT_CONNECTION} subscription={subscription({}, null)} timezone="Asia/Tehran" />);
    expect(screen.getByTestId('mqtt-status')).toHaveAttribute('data-status', 'no_job');
    expect(screen.getByTestId('mqtt-status-badge')).toHaveTextContent('No subscription yet');
    view.rerender(<SubscriptionStatus connection={{ ...MQTT_CONNECTION, configVersion: 2 }} subscription={subscription()} timezone="Asia/Tehran" />);
    expect(screen.getByText('restart pending (config v2, running v1)')).toBeVisible();
  });
});
