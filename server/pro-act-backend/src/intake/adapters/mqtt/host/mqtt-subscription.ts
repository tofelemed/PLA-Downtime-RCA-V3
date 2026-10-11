import { Logger } from '@nestjs/common';
import { IPublishPacket } from 'mqtt';
import { DataSource } from 'typeorm';
import { backoffSeconds } from '../../../../common/helpers/time-bounds';
import { ShutdownCoordinator } from '../../../../common/scheduling/shutdown-coordinator.service';
import { IntegrationConnection } from '../../../entities/integration-connection.entity';
import { IntakeService } from '../../../intake.service';
import { JobLease, recordTransition } from '../../../jobs/job-lease';
import { adapterErrorOf } from '../../adapter-error';
import { MqttConnectionConfig } from '../mqtt-config';
import { MqttAdapter } from '../mqtt.adapter';
import { MessagePersister } from './message-persister';
import { DisconnectMode, MqttSession } from './mqtt-session';
import { HealthTracker } from './subscription-health';
import {
  claimSubscription,
  countParked,
  failSubscription,
  finishDrain,
  heartbeatSubscription,
  releaseSubscription,
  SubscribeJobRow,
} from './subscription-lease';

export interface SubscriptionDeps {
  dataSource: DataSource;
  adapter: MqttAdapter;
  intake: IntakeService;
  shutdown: ShutdownCoordinator;
  /** `runnerIdentity()` of this process */
  owner: string;
  leaseSeconds: number;
}

/** What the host saw of the connection and its job on this sweep. */
export interface SubscriptionView {
  connection: IntegrationConnection;
  job: SubscribeJobRow;
  /** why this connection is a duplicate-feed loser (null = it may run) */
  parked: string | null;
}

interface Running {
  configVersion: number;
  config: MqttConnectionConfig;
}

/**
 * One MQTT subscription hosted in the worker (design §6): holds the job lease, ONE client per
 * connection, the persist-before-ack pipeline and the live health; follows the job state (pause =
 * disconnect with the session kept, resume = reconnect, drain = unsubscribe then stop, stop = session
 * dropped), restarts on `config_version`, parks duplicate-feed losers, retries retryable connect failures
 * with exponential backoff and jitter, and fails the job on non-retryable ones (auth, TLS, egress). A
 * failed job records the configuration version it failed at; the host restarts it once the connection
 * moves past that version (`failed-job-recovery.ts`).
 */
export class MqttSubscription {
  readonly health = new HealthTracker();
  private readonly logger: Logger;
  private lease: JobLease | null = null;
  private session: MqttSession | null = null;
  private persister: MessagePersister | null = null;
  private running: Running | null = null;
  private view: SubscriptionView | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private attempt = 0;
  /** a client is being prepared (secret reveal, options): no second start meanwhile */
  private starting = false;
  /** set before an intentional disconnect that must be followed by a reconnect (persist failure) */
  private reconnectAfterClose = false;

  constructor(
    private readonly deps: SubscriptionDeps,
    readonly connectionId: string,
  ) {
    this.logger = new Logger(`MqttSubscription:${connectionId.slice(0, 8)}`);
  }

  get connected(): boolean {
    return this.session?.connected ?? false;
  }

  async reconcile(view: SubscriptionView): Promise<void> {
    if (!this.view) this.health.seed(view.job.health);
    this.view = view;
    if (view.parked !== null) return this.park(view);
    this.health.unparked();
    switch (view.job.state) {
      case 'running':
        return this.ensureRunning(view);
      case 'draining':
        return this.drain(view);
      case 'stopped':
        return this.suspend('drop');
      default:
        // paused: broker queues on the kept session; created / failed: not ours until started
        return this.suspend('keep');
    }
  }

  /** Lease renewal + health write; a lost lease stops the client (another worker owns the session). */
  async heartbeat(): Promise<void> {
    if (!this.lease) return;
    const manager = this.deps.dataSource.manager;
    this.health.parkedCount(await countParked(manager, this.connectionId));
    const held = await heartbeatSubscription(
      manager,
      this.lease,
      this.health.snapshot(),
      this.health.takeObservation(),
    );
    if (held) return;
    this.logger.warn('Lease lost to another worker: closing the client');
    this.lease = null;
    await this.closeClient('abort');
  }

  /** Clean disconnect with the session kept and the lease released (worker shutdown, connection retired). */
  shutdown(): Promise<void> {
    return this.suspend('keep');
  }

  private async park(view: SubscriptionView): Promise<void> {
    await this.closeClient('keep');
    this.health.parked('duplicate_feed', view.parked ?? '');
    if (!this.lease && !(await this.claim(view.job))) return;
    await this.heartbeat();
  }

  private async ensureRunning(view: SubscriptionView): Promise<void> {
    if (!this.lease && !(await this.claim(view.job))) return;
    const version = view.connection.configVersion;
    if (this.running && this.running.configVersion !== version) {
      this.logger.log(
        `Configuration version ${this.running.configVersion} → ${version}: restarting the client`,
      );
      await this.closeClient('keep');
    }
    if (this.session || this.reconnectTimer || this.starting) return;
    await this.start(view);
  }

  private async drain(view: SubscriptionView): Promise<void> {
    if (!this.lease && !(await this.claim(view.job))) return;
    if (this.session?.connected) {
      await this.session.unsubscribe(this.health.snapshot().subscribedTopics);
    }
    await this.closeClient('keep');
    await finishDrain(
      this.deps.dataSource.manager,
      this.lease as JobLease,
      this.health.snapshot(),
    );
    this.lease = null;
  }

  private async suspend(mode: DisconnectMode): Promise<void> {
    await this.closeClient(mode);
    if (!this.lease) return;
    await releaseSubscription(
      this.deps.dataSource.manager,
      this.lease,
      this.health.snapshot(),
    );
    this.lease = null;
  }

  private async claim(job: SubscribeJobRow): Promise<boolean> {
    const claim = await claimSubscription(
      this.deps.dataSource.manager,
      job.id,
      this.deps.owner,
      this.deps.leaseSeconds,
    );
    if (!claim.claimed) return false;
    this.lease = {
      jobId: job.id,
      tenantId: job.tenantId,
      owner: this.deps.owner,
      leaseSeconds: this.deps.leaseSeconds,
    };
    if (claim.previousOwner) {
      await recordTransition(this.deps.dataSource.manager, {
        tenantId: job.tenantId,
        jobId: job.id,
        action: 'lease_reclaimed',
        fromState: job.state,
        toState: job.state,
        actorId: null,
        runner: this.deps.owner,
        detail: { previousOwner: claim.previousOwner },
      });
    }
    return true;
  }

  private async start(view: SubscriptionView): Promise<void> {
    let prepared: Awaited<ReturnType<MqttAdapter['prepare']>>;
    this.starting = true;
    this.health.preparing(view.connection.configVersion);
    try {
      prepared = await this.deps.adapter.prepare(view.connection, 'subscribe');
    } catch (error) {
      this.starting = false;
      return this.onStartFailure(error);
    }
    this.starting = false;
    const { config, target } = prepared;
    const decodeConnection = {
      tenantId: view.connection.tenantId,
      connectionId: view.connection.id,
      configVersion: view.connection.configVersion,
      config,
    };
    this.running = { configVersion: view.connection.configVersion, config };
    this.persister = new MessagePersister(
      { ...this.deps, health: this.health, logger: this.logger },
      decodeConnection,
      Math.max(1_000, config.mqtt.keepaliveSeconds * 500),
    );
    const session = new MqttSession(
      target,
      {
        protocolVersion: config.mqtt.protocolVersion,
        host: config.broker.host,
        servername: config.mqtt.tls.servername,
      },
      {
        onConnect: (connack) => void this.onConnect(session, connack),
        onClose: (input) => void this.onClose(session, input),
        onMessage: (packet, done) => this.onMessage(session, packet, done),
      },
    );
    this.session = session;
    this.health.connecting(target.clientId, view.connection.configVersion);
    session.connect();
  }

  /** A configuration that cannot run (egress denied, CA unresolved, invalid config): the job fails now. */
  private async onStartFailure(error: unknown): Promise<void> {
    const classified = adapterErrorOf(error);
    const message = error instanceof Error ? error.message : String(error);
    if (classified && !classified.retryable) return this.failJob(message);
    this.logger.warn(`Start failed, retrying with backoff: ${message}`);
    this.health.disconnected(message);
    this.scheduleReconnect();
  }

  private async onConnect(
    session: MqttSession,
    connack: { sessionPresent: boolean },
  ): Promise<void> {
    if (session !== this.session || !this.running) return;
    this.attempt = 0;
    this.health.connected(connack.sessionPresent);
    const wanted = subscriptionsOf(this.running.config);
    const previous = this.health.snapshot().subscribedTopics;
    const stale = previous.filter(
      (topic) => !wanted.some((w) => w.topic === topic),
    );
    const unchanged =
      stale.length === 0 && wanted.every((w) => previous.includes(w.topic));
    try {
      if (!connack.sessionPresent || !unchanged) {
        await session.unsubscribe(stale);
        await session.subscribe(wanted);
      }
      this.health.subscribed(wanted.map((entry) => entry.topic));
      this.logger.log(
        `Connected (session ${connack.sessionPresent ? 'resumed' : 'new'}), ${wanted.length} filter(s)`,
      );
    } catch (error) {
      this.logger.warn(
        `Subscribe failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.reconnectAfterClose = true;
      await session.disconnect('abort');
    }
  }

  private onMessage(
    session: MqttSession,
    packet: IPublishPacket,
    done: () => void,
  ): void {
    const persister = this.persister;
    if (!persister) return;
    void persister.handle(packet, new Date()).then((durable) => {
      if (session !== this.session) return;
      if (durable) return done();
      // not acknowledged: the broker keeps it; reconnect so the stalled socket is not dropped by keepalive
      this.reconnectAfterClose = true;
      void session.disconnect('abort');
    });
  }

  /** The socket is gone without `closeClient` having asked for it: fail, or reconnect with backoff. */
  private async onClose(
    session: MqttSession,
    input: {
      intentional: boolean;
      failure: { message: string; retryable: boolean } | null;
    },
  ): Promise<void> {
    if (session !== this.session) return;
    const { failure } = input;
    this.session = null;
    this.health.disconnected(failure?.message ?? null);
    const reconnect = this.reconnectAfterClose || !input.intentional;
    this.reconnectAfterClose = false;
    if (failure && !failure.retryable) return this.failJob(failure.message);
    if (failure) this.logger.warn(`Connection lost: ${failure.message}`);
    if (reconnect) this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.running) return;
    const { minSeconds, maxSeconds } = this.running.config.mqtt.reconnect;
    const base = backoffSeconds(this.attempt, minSeconds, maxSeconds) * 1000;
    const delay = Math.min(base * (0.5 + Math.random()), maxSeconds * 1000);
    this.attempt += 1;
    this.health.reconnecting();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.view?.job.state !== 'running' || !this.lease || this.starting)
        return;
      void this.start(this.view).catch((error: unknown) =>
        this.logger.error(`Reconnect failed: ${String(error)}`),
      );
    }, delay);
    this.reconnectTimer.unref();
  }

  private async failJob(error: string): Promise<void> {
    this.logger.error(`Subscription failed (not retryable): ${error}`);
    await this.closeClient('keep');
    this.health.disconnected(error);
    if (!this.lease) return;
    await failSubscription(this.deps.dataSource.manager, this.lease, {
      error,
      health: this.health.snapshot(),
      from: this.view?.job.state ?? 'running',
      configVersion: this.view?.connection.configVersion ?? null,
    });
    this.lease = null;
  }

  /** Stops reconnecting, waits for the message in flight, closes the session. */
  private async closeClient(mode: DisconnectMode): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // the message in flight is acknowledged first (its session is still current until here)
    if (this.persister) await this.persister.inflight;
    const session = this.session;
    this.session = null;
    this.running = null;
    this.persister = null;
    if (session) await session.disconnect(mode);
    this.health.disconnected(null);
  }
}

/** The topic allowlist at the configured QoS plus the availability topic (design §4.2 stage 1). */
function subscriptionsOf(
  config: MqttConnectionConfig,
): Array<{ topic: string; qos: 0 | 1 | 2 }> {
  const { topics, qos, availabilityTopic } = config.mqtt;
  const list = topics.map((topic) => ({ topic, qos }));
  if (availabilityTopic && !topics.includes(availabilityTopic)) {
    list.push({ topic: availabilityTopic, qos: 1 });
  }
  return list;
}
