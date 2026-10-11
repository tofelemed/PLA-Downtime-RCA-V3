import { AcceptStatus } from '../../../intake.types';

/** Per-connection counters since the subscription started in this process (design §8). */
export interface SubscriptionCounters {
  received: number;
  accepted: number;
  duplicate: number;
  stale: number;
  conflict: number;
  quarantined: number;
  /** open parking rows of the connection (unknown template / signal / code), refreshed on heartbeat */
  parked: number;
}

/**
 * `ingestion_jobs.health` of a subscription (design §8, "health must not lie": a client that receives
 * but cannot persist shows `persistFailed`, never green). Written by the host on every heartbeat as a
 * JSON merge, so keys owned by the normalisation side (`sourceAvailable`, `lastAvailabilityAt`) survive.
 */
export interface SubscriptionHealth {
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
  parkedReason: 'duplicate_feed' | null;
  parkedDetail: string | null;
  counters: SubscriptionCounters;
}

export type PersistOutcome = AcceptStatus | 'quarantined';

const ACCEPTED: ReadonlySet<PersistOutcome> = new Set([
  'accepted',
  'revision',
  'replayed',
]);

export function emptyHealth(): SubscriptionHealth {
  return {
    connected: false,
    connectionError: null,
    reconnects: 0,
    lastMessageAt: null,
    lastPersistAt: null,
    persistFailed: null,
    inflight: 0,
    sessionPresent: null,
    effectiveClientId: null,
    configVersion: null,
    subscribedTopics: [],
    parkedReason: null,
    parkedDetail: null,
    counters: {
      received: 0,
      accepted: 0,
      duplicate: 0,
      stale: 0,
      conflict: 0,
      quarantined: 0,
      parked: 0,
    },
  };
}

/** Mutable health of one subscription; `snapshot()` is what the heartbeat writes. */
export class HealthTracker {
  private readonly health = emptyHealth();
  private observedAt: Date | null = null;

  snapshot(): SubscriptionHealth {
    return {
      ...this.health,
      subscribedTopics: [...this.health.subscribedTopics],
      persistFailed: this.health.persistFailed
        ? { ...this.health.persistFailed }
        : null,
      counters: { ...this.health.counters },
    };
  }

  /** The latest source observation time persisted since the previous call (for `last_observation_at`). */
  takeObservation(): Date | null {
    const at = this.observedAt;
    this.observedAt = null;
    return at;
  }

  /** Carries over what survives a worker restart: the filters the broker session already holds. */
  seed(previous: Record<string, unknown>): void {
    const topics = previous.subscribedTopics;
    if (Array.isArray(topics)) {
      this.health.subscribedTopics = topics.filter(
        (topic): topic is string => typeof topic === 'string',
      );
    }
  }

  connecting(clientId: string, configVersion: number): void {
    this.health.effectiveClientId = clientId;
    this.health.configVersion = configVersion;
  }

  connected(sessionPresent: boolean): void {
    this.health.connected = true;
    this.health.connectionError = null;
    this.health.sessionPresent = sessionPresent;
  }

  subscribed(topics: readonly string[]): void {
    this.health.subscribedTopics = [...topics];
  }

  disconnected(error: string | null): void {
    this.health.connected = false;
    this.health.inflight = 0;
    if (error) this.health.connectionError = error;
  }

  reconnecting(): void {
    this.health.reconnects += 1;
  }

  received(at: Date): void {
    this.health.counters.received += 1;
    this.health.lastMessageAt = at.toISOString();
    this.health.inflight = 1;
  }

  persisted(outcome: PersistOutcome, observedAt: Date | null): void {
    const counters = this.health.counters;
    if (ACCEPTED.has(outcome)) counters.accepted += 1;
    else if (outcome === 'duplicate' || outcome === 'duplicate_content')
      counters.duplicate += 1;
    else if (outcome === 'stale') counters.stale += 1;
    else if (outcome === 'conflict') counters.conflict += 1;
    else counters.quarantined += 1;
    this.health.inflight = 0;
    this.health.lastPersistAt = new Date().toISOString();
    this.health.persistFailed = null;
    if (observedAt && (!this.observedAt || observedAt > this.observedAt)) {
      this.observedAt = observedAt;
    }
  }

  persistFailed(error: string): void {
    this.health.inflight = 0;
    this.health.persistFailed = {
      at: new Date().toISOString(),
      error: error.slice(0, 500),
    };
  }

  parked(reason: 'duplicate_feed', detail: string): void {
    this.health.parkedReason = reason;
    this.health.parkedDetail = detail.slice(0, 500);
  }

  unparked(): void {
    this.health.parkedReason = null;
    this.health.parkedDetail = null;
  }

  parkedCount(count: number): void {
    this.health.counters.parked = count;
  }
}
