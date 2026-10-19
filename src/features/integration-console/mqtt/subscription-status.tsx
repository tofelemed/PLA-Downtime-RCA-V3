import type { ReactNode } from 'react';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { Badge } from '@/components/ui/badge';
import { JOB_STATE_LABELS, labelOf } from '@/features/ux-kit/labels';
import { DurationText } from '@/features/ux-kit/duration-text';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { ToneBadge } from '../components/tone-badge';
import type { MqttSubscription } from './hooks/use-mqtt-subscription';
import { secondsSince } from './model/mqtt-health';

export interface SubscriptionStatusProps {
  connection: ConnectionView;
  subscription: MqttSubscription;
  timezone: string;
}

/** QA L24: the worker's message and persist facts restart with the worker; the last observation is stored. */
const SINCE_WORKER_NONE = 'none since the worker started';
const yesNo = (value: boolean | null) => (value === null ? 'unknown' : value ? 'yes' : 'no');

/** Operational health stays visible; protocol and lease details remain available on request. */
export function SubscriptionStatus({ connection, subscription, timezone }: SubscriptionStatusProps) {
  const { job, health, status, now } = subscription;
  const ago = (iso: string | null, none = 'never') => {
    const seconds = secondsSince(iso, now);
    return seconds === null ? none : <><PlantTime iso={iso} tz={timezone} withDate /> (<DurationText seconds={seconds} variant="compact" /> ago)</>;
  };
  return (
    <section aria-label="Subscription status" className="min-w-0 space-y-4 rounded-lg border bg-background p-4 text-sm" data-testid="mqtt-status" data-status={status.status} data-job-state={job?.state ?? 'none'}>
      <SubscriptionHeading connection={connection} subscription={subscription} />
      {health.persistFailed && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs" data-testid="mqtt-persist-failure">
        <p className="font-semibold text-destructive">Persist failed</p>
        <p className="mt-1 break-words"><PlantTime iso={health.persistFailed.at} tz={timezone} withDate /> — {health.persistFailed.error}</p>
      </div>}
      <dl className="grid min-w-0 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3" aria-label="Operational subscription facts">
        <Fact label="Last observation">{ago(job?.lastObservationAt ?? null)}</Fact>
        <Fact label="Last message (since the worker started)" testId="mqtt-last-message">{ago(health.lastMessageAt, SINCE_WORKER_NONE)}</Fact>
        <Fact label="Last persist (since the worker started)">{ago(health.lastPersistAt, SINCE_WORKER_NONE)}</Fact>
        <Fact label="Heartbeat">{ago(job?.heartbeatAt ?? null)}</Fact>
        <Fact label="In flight">{health.inflight}</Fact>
        <Fact label="Reconnects" testId="mqtt-reconnects">{health.reconnects}</Fact>
      </dl>
      <TechnicalDetails connection={connection} subscription={subscription} ago={ago} />
    </section>
  );
}

type HeadingProps = Pick<SubscriptionStatusProps, 'connection' | 'subscription'>;

function SubscriptionHeading({ connection, subscription }: HeadingProps) {
  const { job, health, status } = subscription;
  const restartPending = job !== null && health.configVersion !== null && health.configVersion !== connection.configVersion;
  return <div className="space-y-2">
    <h2 className="font-semibold">Subscription health</h2>
    <div className="flex flex-wrap items-center gap-2">
      <ToneBadge tone={status.tone} testId="mqtt-status-badge">{status.label}</ToneBadge>
      {job && <Badge variant="outline" data-testid="mqtt-job-state" data-state={job.state}>Job: {labelOf(JOB_STATE_LABELS, job.state).toLowerCase()}</Badge>}
      {health.sourceAvailable !== null && <ToneBadge tone={health.sourceAvailable ? 'ok' : 'warning'} testId="mqtt-source-available">source {health.sourceAvailable ? 'available' : 'unavailable (Last Will / OFFLINE)'}</ToneBadge>}
      {restartPending && <ToneBadge tone="busy">restart pending (config v{connection.configVersion}, running v{health.configVersion})</ToneBadge>}
    </div>
    {status.detail && <p className="break-words text-xs text-destructive">{status.detail}</p>}
  </div>;
}

function TechnicalDetails({ connection, subscription, ago }: HeadingProps & { ago: (iso: string | null, none?: string) => ReactNode }) {
  const { job, health } = subscription;
  return <details className="min-w-0 border-t pt-3" data-testid="mqtt-technical-details">
    <summary className="cursor-pointer rounded-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Technical connection details</summary>
    <dl className="mt-3 grid min-w-0 gap-3 text-xs sm:grid-cols-2">
      <Fact label="Effective client id" testId="mqtt-client-id"><span className="break-all font-mono">{health.effectiveClientId ?? connection.effectiveClientId ?? '—'}</span></Fact>
      <Fact label="Session present on last connect">{yesNo(health.sessionPresent)}</Fact>
      <Fact label="Lease">{job?.leaseOwner ? `${job.leaseOwner} until ${job.leaseExpiry ?? '—'}` : 'none'}</Fact>
      <Fact label="Subscribed filters"><span className="break-all font-mono">{health.subscribedTopics.length > 0 ? health.subscribedTopics.join(', ') : 'none yet'}</span></Fact>
      {health.lastAvailabilityAt && <Fact label="Last availability message">{ago(health.lastAvailabilityAt)}</Fact>}
    </dl>
  </details>;
}

function Fact({ label, testId, children }: { label: string; testId?: string; children: ReactNode }) {
  return <div className="min-w-0 space-y-1"><dt className="text-muted-foreground">{label}</dt><dd className="break-words" data-testid={testId}>{children}</dd></div>;
}
