import type { IngestionJobView } from '@/api/v2/types/integrations';
import type { Tone } from '../../model/job-states';

/** The keys `subscription-health.ts` writes on every heartbeat, plus the normaliser's availability keys. */
export const COUNTER_KEYS = ['received', 'accepted', 'duplicate', 'stale', 'conflict', 'quarantined', 'quarantined_open', 'parked'] as const;
export type CounterKey = (typeof COUNTER_KEYS)[number];

export interface MqttHealthView {
  connected: boolean;
  connectionError: string | null;
  reconnects: number;
  lastMessageAt: string | null;
  lastPersistAt: string | null;
  persistFailed: { at: string; error: string } | null;
  inflight: number;
  sessionPresent: boolean | null;
  effectiveClientId: string | null;
  configVersion: number | null;
  subscribedTopics: string[];
  parkedReason: string | null;
  parkedDetail: string | null;
  counters: Record<CounterKey, number>;
  sourceAvailable: boolean | null;
  lastAvailabilityAt: string | null;
}

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const bool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** The subscription health of a job as the host wrote it (unknown or missing keys read as empty). */
export function mqttHealthOf(health: Record<string, unknown> | null | undefined): MqttHealthView {
  const source = health ?? {};
  const failed = record(source.persistFailed);
  const counters = record(source.counters);
  return {
    connected: source.connected === true,
    connectionError: str(source.connectionError),
    reconnects: num(source.reconnects),
    lastMessageAt: str(source.lastMessageAt),
    lastPersistAt: str(source.lastPersistAt),
    persistFailed: typeof failed.at === 'string' ? { at: failed.at, error: str(failed.error) ?? '' } : null,
    inflight: num(source.inflight),
    sessionPresent: bool(source.sessionPresent),
    effectiveClientId: str(source.effectiveClientId),
    configVersion: typeof source.configVersion === 'number' ? source.configVersion : null,
    subscribedTopics: Array.isArray(source.subscribedTopics) ? source.subscribedTopics.filter((topic): topic is string => typeof topic === 'string') : [],
    parkedReason: str(source.parkedReason),
    parkedDetail: str(source.parkedDetail),
    counters: Object.fromEntries(COUNTER_KEYS.map((key) => [key, num(counters[key])])) as Record<CounterKey, number>,
    sourceAvailable: bool(source.sourceAvailable),
    lastAvailabilityAt: str(source.lastAvailabilityAt),
  };
}

/** The connection's subscription job (`scope.mode = subscribe`; the worker creates one per active connection). */
export function subscribeJobOf(jobs: readonly IngestionJobView[]): IngestionJobView | null {
  const subscriptions = jobs.filter((job) => job.scope.mode === 'subscribe');
  return subscriptions.find((job) => job.state !== 'stopped') ?? subscriptions[subscriptions.length - 1] ?? null;
}

/**
 * Whether the console waits for the worker: an active connection's subscribe job is created (and then
 * started) by the worker's reconcile, not by a command, so the jobs list polls until it is running.
 */
export function awaitsSubscribeJob(jobs: readonly IngestionJobView[]): boolean {
  const job = subscribeJobOf(jobs);
  return job === null || job.state === 'created';
}

export type SubscriptionStatus ='no_job' | 'connected' | 'disconnected' | 'parked' | 'persist_failed' | 'no_lease' | 'paused' | 'draining' | 'stopped' | 'failed' | 'created';

export interface SubscriptionStatusView {
  status: SubscriptionStatus;
  tone: Tone;
  label: string;
  detail: string | null;
}

const idle = (status: SubscriptionStatus, label: string, detail: string | null = null): SubscriptionStatusView => ({ status, tone: 'idle', label, detail });

/**
 * One status from the job state and its health (design §8 "health must not lie"): a client that
 * receives but cannot persist is an error, a duplicate-feed park and a disconnect are warnings.
 */
export function subscriptionStatus(job: IngestionJobView | null, health: MqttHealthView, now: number): SubscriptionStatusView {
  if (!job) return idle('no_job', 'No subscription yet', 'The worker creates the subscribe job within 10 s of an active connection.');
  if (job.state === 'failed') return { status: 'failed', tone: 'error', label: 'Failed', detail: job.lastError };
  if (job.state === 'paused') return idle('paused', 'Paused (broker queues in the persistent session)');
  if (job.state === 'stopped') return idle('stopped', 'Stopped (broker session dropped)');
  if (job.state === 'created') return idle('created', 'Created, not started');
  if (health.parkedReason) return { status: 'parked', tone: 'warning', label: 'Parked: duplicate feed', detail: health.parkedDetail };
  if (health.persistFailed) return { status: 'persist_failed', tone: 'error', label: 'Receiving but cannot persist', detail: health.persistFailed.error };
  if (job.leaseExpiry !== null && Date.parse(job.leaseExpiry) < now) return { status: 'no_lease', tone: 'warning', label: 'No live lease (waiting for a worker)', detail: null };
  if (!health.connected) return { status: 'disconnected', tone: 'warning', label: 'Disconnected', detail: health.connectionError };
  if (job.state === 'draining') return { status: 'draining', tone: 'busy', label: 'Draining (finishing in flight, then stops)', detail: null };
  return { status: 'connected', tone: 'ok', label: 'Connected', detail: null };
}

/** Signed seconds since an ISO time, for "x ago" badges (null = never; negative = the time is ahead of `now`). */
export function secondsSince(iso: string | null, now: number): number | null {
  return iso ? Math.round((now - Date.parse(iso)) / 1000) : null;
}
