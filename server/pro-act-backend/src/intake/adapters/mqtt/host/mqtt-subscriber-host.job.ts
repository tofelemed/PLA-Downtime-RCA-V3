import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { envInt } from '../../../../common/helpers/time-bounds';
import { MqttSubscriberHost } from './mqtt-subscriber-host';

/**
 * The host's clock where the scheduler runs (worker / all; inert in the API process like every
 * `@Interval` provider): reconcile every 10 s (safety net behind the outbox fast path), heartbeat
 * every 20 s (lease 60 s).
 */
@Injectable()
export class MqttSubscriberHostJob {
  private readonly logger = new Logger(MqttSubscriberHostJob.name);

  constructor(private readonly host: MqttSubscriberHost) {}

  @Interval(envInt('MQTT_RECONCILE_INTERVAL_MS', 10_000))
  async reconcileTick(): Promise<void> {
    try {
      await this.host.reconcile();
    } catch (error) {
      this.logger.error(
        'MQTT reconcile tick failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @Interval(envInt('MQTT_HEARTBEAT_INTERVAL_MS', 20_000))
  async heartbeatTick(): Promise<void> {
    try {
      await this.host.heartbeat();
    } catch (error) {
      this.logger.error(
        'MQTT heartbeat tick failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
