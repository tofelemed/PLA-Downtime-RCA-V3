import { COUNTER_KEYS, type CounterKey, type MqttHealthView } from './model/mqtt-health';

const LABELS: Record<CounterKey, string> = {
  received: 'Received',
  accepted: 'Accepted',
  duplicate: 'Duplicate',
  stale: 'Stale',
  conflict: 'Conflict',
  quarantined: 'Quarantined',
  parked: 'Parked (open)',
};

/** Counters since the subscription started in the worker process (reset on restart; the server counts). */
export function SubscriptionCounters({ health }: { health: MqttHealthView }) {
  return (
    <dl className="grid grid-cols-4 gap-2 text-center text-xs sm:grid-cols-7" aria-label="Subscription counters" data-testid="mqtt-counters">
      {COUNTER_KEYS.map((key) => (
        <div key={key} className="rounded-md border p-2" data-counter={key}>
          <dt className="text-muted-foreground">{LABELS[key]}</dt>
          <dd className="text-base font-semibold tabular-nums">{health.counters[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
