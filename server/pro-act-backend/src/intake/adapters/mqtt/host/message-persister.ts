import { Logger } from '@nestjs/common';
import { IPublishPacket } from 'mqtt';
import { withTimeout } from '../../../../common/helpers/time-bounds';
import { ShutdownCoordinator } from '../../../../common/scheduling/shutdown-coordinator.service';
import { IntakeService } from '../../../intake.service';
import { DecodeConnection, DecodeInput } from '../decode-result';
import { decodeMqttMessage } from '../profiles';
import { rejectedDeliveryOf } from './decode-quarantine';
import { HealthTracker } from './subscription-health';

export interface PersisterDeps {
  intake: IntakeService;
  shutdown: ShutdownCoordinator;
  health: HealthTracker;
  logger: Logger;
}

/**
 * The persist-before-ack pipeline of one session (design §4.1 steps 2–12): decode → `IntakeService.accept`
 * (or `quarantineDelivery` for a typed rejection, so a poison message never blocks the session) → the
 * PUBACK callback only after the transaction committed. Every persist is bounded (0.5 × keepalive by
 * default): a held callback stalls mqtt.js's inbound socket and a hold longer than 1.5 × keepalive drops
 * the connection by itself (spike, `plans/evidence/mqtt-certification.md`), so on a database error or
 * timeout the caller disconnects deliberately instead and the broker redelivers.
 */
export class MessagePersister {
  private pending: Promise<void> = Promise.resolve();

  constructor(
    private readonly deps: PersisterDeps,
    private readonly connection: DecodeConnection,
    private readonly timeoutMs: number,
  ) {}

  /** Resolves once the message in flight (if any) has settled either way. */
  get inflight(): Promise<void> {
    return this.pending;
  }

  /** True when the delivery is durable (acknowledge); false when it must not be acknowledged. */
  async handle(packet: IPublishPacket, receivedAt: Date): Promise<boolean> {
    this.deps.health.received(receivedAt);
    const work = this.deps.shutdown.track(this.persist(packet, receivedAt));
    this.pending = work.then(
      () => undefined,
      () => undefined,
    );
    try {
      await work;
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.deps.health.persistFailed(message);
      this.deps.logger.warn(
        `MQTT connection ${this.connection.connectionId}: persist of ${packet.topic} failed, not acknowledged: ${message}`,
      );
      return false;
    }
  }

  private async persist(
    packet: IPublishPacket,
    receivedAt: Date,
  ): Promise<void> {
    const input = this.inputOf(packet, receivedAt);
    const decoded = decodeMqttMessage(input);
    const binding = {
      tenantId: this.connection.tenantId,
      connectionId: this.connection.connectionId,
    };
    const work = decoded.ok
      ? this.deps.intake.accept(binding, decoded.envelope)
      : this.deps.intake.quarantineDelivery(
          binding,
          rejectedDeliveryOf(input, decoded),
        );
    const result = await withTimeout(
      work,
      this.timeoutMs,
      `persist ${packet.topic}`,
    );
    if (!decoded.ok) {
      this.deps.logger.warn(
        `MQTT connection ${binding.connectionId}: ${packet.topic} quarantined as ${decoded.code} (${result.status})`,
      );
    }
    this.deps.health.persisted(
      decoded.ok ? result.status : 'quarantined',
      decoded.ok ? new Date(decoded.envelope.observedAt) : null,
    );
  }

  private inputOf(packet: IPublishPacket, receivedAt: Date): DecodeInput {
    return {
      topic: packet.topic,
      payload: Buffer.isBuffer(packet.payload)
        ? packet.payload
        : Buffer.from(packet.payload),
      retained: packet.retain,
      qos: packet.qos,
      dup: packet.dup,
      packetId: packet.messageId ?? null,
      receivedAt,
      connection: this.connection,
    };
  }
}
