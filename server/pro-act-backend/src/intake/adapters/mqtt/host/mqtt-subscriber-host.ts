import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { envInt } from '../../../../common/helpers/time-bounds';
import { InProcessEventBus } from '../../../../common/outbox/in-process-event-bus';
import {
  getProcessRole,
  runsSchedulers,
} from '../../../../common/scheduling/process-role';
import { runnerIdentity } from '../../../../common/scheduling/runner-identity';
import { ShutdownCoordinator } from '../../../../common/scheduling/shutdown-coordinator.service';
import { IntegrationConnection } from '../../../entities/integration-connection.entity';
import { IntakeService } from '../../../intake.service';
import { scopeHash } from '../../../jobs/ingestion-jobs.service';
import { SUBSCRIBE_MODE } from '../../../jobs/job-lease';
import { assertNoDuplicateFeed, FeedPeer } from '../duplicate-feed';
import { parseMqttConfig } from '../mqtt-config';
import { MqttAdapter } from '../mqtt.adapter';
import { MqttSubscription } from './mqtt-subscription';
import { SubscriptionHealth } from './subscription-health';
import {
  createSubscribeJob,
  findSubscribeJob,
  SubscribeJobRow,
  updateSubscribeScope,
} from './subscription-lease';

/** Outbox events after which the host reconciles at once instead of on its next sweep. */
const FAST_PATH_EVENTS = ['ConnectionChanged', 'IngestionJobChanged'];

/**
 * Worker-side host of the MQTT subscriptions (design §6, plan 1.8 WP3 step 3). Every sweep (10 s, and
 * on `ConnectionChanged` / `IngestionJobChanged`) it makes sure each active MQTT connection has ONE
 * `ingestion_jobs` row with `scope.mode = 'subscribe'` (never due, never claimed by the pull runner),
 * decides duplicate-feed losers (oldest connection wins, the others park), and hands each connection to
 * its `MqttSubscription` which follows the job state. Active only where schedulers run (worker / all).
 */
@Injectable()
export class MqttSubscriberHost
  implements OnModuleInit, BeforeApplicationShutdown
{
  private readonly logger = new Logger(MqttSubscriberHost.name);
  private readonly subscriptions = new Map<string, MqttSubscription>();
  private readonly enabled = runsSchedulers(getProcessRole());
  private sweep: Promise<void> | null = null;
  private sweepAgain = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly adapter: MqttAdapter,
    private readonly intake: IntakeService,
    private readonly bus: InProcessEventBus,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  /** The fast path never holds the outbox relay: the sweep runs in the background and logs its failure. */
  onModuleInit(): void {
    if (!this.enabled) return;
    for (const type of FAST_PATH_EVENTS) {
      this.bus.subscribe(type, () => {
        void this.reconcile().catch((error: unknown) =>
          this.logger.error(`Reconcile after ${type} failed: ${String(error)}`),
        );
        return Promise.resolve();
      });
    }
  }

  get active(): boolean {
    return this.enabled;
  }

  /** Live health of a hosted connection (null when this process hosts nothing for it). */
  healthOf(connectionId: string): SubscriptionHealth | null {
    return this.subscriptions.get(connectionId)?.health.snapshot() ?? null;
  }

  /** One sweep at a time; a request during a sweep queues exactly one more. */
  reconcile(): Promise<void> {
    if (!this.enabled || this.shutdown.isShuttingDown) return Promise.resolve();
    if (this.sweep) {
      this.sweepAgain = true;
      return this.sweep;
    }
    this.sweep = this.sweepOnce().finally(() => {
      this.sweep = null;
      if (!this.sweepAgain) return;
      this.sweepAgain = false;
      void this.reconcile();
    });
    return this.sweep;
  }

  /** Lease renewal and health write of every hosted subscription (every 20 s). */
  async heartbeat(): Promise<void> {
    for (const [id, subscription] of this.subscriptions) {
      try {
        await subscription.heartbeat();
      } catch (error) {
        this.logger.error(`Heartbeat of ${id} failed: ${String(error)}`);
      }
    }
  }

  async beforeApplicationShutdown(): Promise<void> {
    for (const [id, subscription] of this.subscriptions) {
      try {
        await subscription.shutdown();
      } catch (error) {
        this.logger.error(`Shutdown of ${id} failed: ${String(error)}`);
      }
    }
    this.subscriptions.clear();
  }

  private async sweepOnce(): Promise<void> {
    const connections = await this.dataSource.manager.find(
      IntegrationConnection,
      {
        where: { sourceType: 'mqtt' },
        order: { createdAt: 'ASC', id: 'ASC' },
      },
    );
    const active = connections.filter((connection) => connection.isActive);
    const losers = duplicateFeedLosers(active);
    for (const connection of active) {
      try {
        await this.reconcileOne(connection, losers.get(connection.id) ?? null);
      } catch (error) {
        this.logger.error(
          `Reconcile of connection ${connection.id} failed: ${String(error)}`,
        );
      }
    }
    const activeIds = new Set(active.map((connection) => connection.id));
    for (const [id, subscription] of this.subscriptions) {
      if (activeIds.has(id)) continue;
      await subscription.shutdown();
      this.subscriptions.delete(id);
    }
  }

  private async reconcileOne(
    connection: IntegrationConnection,
    parked: string | null,
  ): Promise<void> {
    const job = await this.ensureJob(this.dataSource.manager, connection);
    if (!job) return;
    let subscription = this.subscriptions.get(connection.id);
    if (!subscription) {
      subscription = new MqttSubscription(
        {
          dataSource: this.dataSource,
          adapter: this.adapter,
          intake: this.intake,
          shutdown: this.shutdown,
          owner: runnerIdentity(),
          leaseSeconds: envInt('INTAKE_LEASE_SECONDS', 60),
        },
        connection.id,
      );
      this.subscriptions.set(connection.id, subscription);
    }
    await subscription.reconcile({ connection, job, parked });
  }

  /** The connection's subscription job: created running when missing; its scope follows the config. */
  private async ensureJob(
    manager: EntityManager,
    connection: IntegrationConnection,
  ): Promise<SubscribeJobRow | null> {
    const scope = scopeOf(connection);
    if (!scope) {
      this.logger.warn(
        `Connection ${connection.id} has an invalid MQTT configuration; no subscription`,
      );
      return null;
    }
    const existing = await findSubscribeJob(manager, connection.id);
    if (!existing) {
      return createSubscribeJob(manager, {
        tenantId: connection.tenantId,
        connectionId: connection.id,
        scope,
        runner: runnerIdentity(),
      });
    }
    if (
      existing.state !== 'stopped' &&
      scopeHash(existing.scope) !== scopeHash(scope)
    ) {
      await updateSubscribeScope(manager, existing.id, scope);
      return { ...existing, scope };
    }
    return existing;
  }
}

/** `{ mode: 'subscribe', topics, profile }` of a connection, or null when its configuration is invalid. */
function scopeOf(
  connection: IntegrationConnection,
): Record<string, unknown> | null {
  try {
    const config = parseMqttConfig(connection.endpointConfig);
    return {
      mode: SUBSCRIBE_MODE,
      topics: [...config.mqtt.topics],
      profile: config.payloadProfile.kind,
    };
  } catch {
    return null;
  }
}

/**
 * Runtime duplicate-feed rule (design §3): within a tenant the oldest active connection of a broker /
 * topic overlap / client id runs, later ones park with the reason. Returns loser id → reason.
 */
function duplicateFeedLosers(
  active: readonly IntegrationConnection[],
): Map<string, string> {
  const winners = new Map<string, FeedPeer[]>();
  const losers = new Map<string, string>();
  for (const connection of active) {
    const peers = winners.get(connection.tenantId) ?? [];
    try {
      assertNoDuplicateFeed(
        {
          endpointConfig: connection.endpointConfig,
          connectionId: connection.id,
        },
        peers,
      );
      peers.push({
        id: connection.id,
        displayName: connection.displayName,
        endpointConfig: connection.endpointConfig,
      });
      winners.set(connection.tenantId, peers);
    } catch (error) {
      losers.set(
        connection.id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return losers;
}
