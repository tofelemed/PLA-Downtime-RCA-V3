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

const yesNo = (value: boolean | null) => (value === null ? 'unknown' : value ? 'yes' : 'no');

/** Live facts of the subscription from the worker's heartbeat (`ingestion_jobs.health`, design §8). */
export function SubscriptionStatus({ connection, subscription, timezone }: SubscriptionStatusProps) {
  const { job, health, status, now } = subscription;
  const ago = (iso: string | null) => {
    const seconds = secondsSince(iso, now);
    return seconds === null ? (
      'never'
    ) : (
      <>
        <PlantTime iso={iso} tz={timezone} withDate /> (<DurationText seconds={seconds} variant="compact" /> ago)
      </>
    );
  };
  const restartPending = job !== null && health.configVersion !== null && health.configVersion !== connection.configVersion;
  return (
    <section aria-label="Subscription status" className="space-y-2 rounded-md border p-3 text-sm" data-testid="mqtt-status" data-status={status.status} data-job-state={job?.state ?? 'none'}>
      <div className="flex flex-wrap items-center gap-2">
        <ToneBadge tone={status.tone} testId="mqtt-status-badge">
          {status.label}
        </ToneBadge>
        {job && <Badge variant="outline" data-testid="mqtt-job-state" data-state={job.state}>Job: {labelOf(JOB_STATE_LABELS, job.state).toLowerCase()}</Badge>}
        {health.sourceAvailable !== null && (
          <ToneBadge tone={health.sourceAvailable ? 'ok' : 'warning'} testId="mqtt-source-available">
            source {health.sourceAvailable ? 'available' : 'unavailable (Last Will / OFFLINE)'}
          </ToneBadge>
        )}
        {restartPending && <ToneBadge tone="busy">restart pending (config v{connection.configVersion}, running v{health.configVersion})</ToneBadge>}
      </div>
      {status.detail && <p className="text-xs text-destructive">{status.detail}</p>}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Effective client id</dt>
          <dd className="break-all font-mono" data-testid="mqtt-client-id">{health.effectiveClientId ?? connection.effectiveClientId ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Session present on last connect</dt>
          <dd>{yesNo(health.sessionPresent)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reconnects</dt>
          <dd data-testid="mqtt-reconnects">{health.reconnects}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last message</dt>
          <dd data-testid="mqtt-last-message">{ago(health.lastMessageAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last persist</dt>
          <dd>{ago(health.lastPersistAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">In flight</dt>
          <dd>{health.inflight}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Heartbeat</dt>
          <dd>{ago(job?.heartbeatAt ?? null)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last observation</dt>
          <dd>{ago(job?.lastObservationAt ?? null)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Lease</dt>
          <dd>{job?.leaseOwner ? `${job.leaseOwner} until ${job.leaseExpiry ?? '—'}` : 'none'}</dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-muted-foreground">Subscribed filters</dt>
          <dd className="font-mono">{health.subscribedTopics.length > 0 ? health.subscribedTopics.join(', ') : 'none yet'}</dd>
        </div>
        {health.persistFailed && (
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-muted-foreground">Persist failed</dt>
            <dd className="text-destructive">
              <PlantTime iso={health.persistFailed.at} tz={timezone} withDate /> — {health.persistFailed.error}
            </dd>
          </div>
        )}
        {health.lastAvailabilityAt && (
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-muted-foreground">Last availability message</dt>
            <dd>{ago(health.lastAvailabilityAt)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
