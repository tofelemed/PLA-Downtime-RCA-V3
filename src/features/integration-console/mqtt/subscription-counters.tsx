import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { COUNTER_KEYS, type CounterKey, type MqttHealthView } from './model/mqtt-health';

const COUNTERS_NOTE = 'Counted since the worker last started (reset when it restarts); stored observations are not affected. Quarantined (open) and Parked (open) are the exception rows open now.';

const LABELS: Record<CounterKey, string> = {
  received: 'Received',
  accepted: 'Accepted',
  duplicate: 'Duplicate',
  stale: 'Stale',
  conflict: 'Conflict',
  quarantined: 'Rejected at decode',
  quarantined_open: 'Quarantined (open)',
  parked: 'Parked (open)',
};

/** Counters since the subscription started in the worker process (reset on restart; the server counts). */
export function SubscriptionCounters({ health }: { health: MqttHealthView }) {
  return (
    <div className="space-y-1">
    <div className="flex items-center gap-1.5">
      <h3 className="text-sm font-medium">Counters</h3>
      <KpiInfo label="Counters" text={COUNTERS_NOTE} />
    </div>
    <dl className="grid grid-cols-4 gap-2 text-center text-xs lg:grid-cols-8" aria-label="Subscription counters since the worker started" data-testid="mqtt-counters">
      {COUNTER_KEYS.map((key) => (
        <div key={key} className="rounded-md border p-2" data-counter={key}>
          <dt className="text-muted-foreground">{LABELS[key]}</dt>
          <dd className="text-base font-semibold tabular-nums">{health.counters[key]}</dd>
        </div>
      ))}
    </dl>
    </div>
  );
}
