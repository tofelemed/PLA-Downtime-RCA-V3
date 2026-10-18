import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { enqueueOutbox } from '../../../../common/outbox/outbox-writer';
import { CanonicalEnvelope } from '../../../envelope/canonical-envelope';
import { SUBSCRIBE_MODE } from '../../../jobs/job-lease';
import {
  NormalizationHandler,
  NormalizationHandlerRegistry,
  NormalizationInput,
  NormalizationResult,
} from '../../../normalization/normalization-handler';

/** Outbox event of a source becoming (un)available (design §4.5, T11): health, never a stop. */
export const SOURCE_HEALTH_CHANGED = 'SourceHealthChanged';

/**
 * Normaliser of MQTT `state` envelopes (plan 1.8 WP3 step 3). Availability messages (contract §3.5,
 * `sourceControls.mqtt.availability`) update the subscription's health (`sourceAvailable`,
 * `lastAvailabilityAt`, `sourcePiConnected`) and publish `SourceHealthChanged`; a Last Will OFFLINE
 * therefore means "source unavailable", never "equipment stopped" (MQ04, T11). Plain machine-state
 * observations become digital measurements bound to a state signal by their MQTT topic. The shared
 * measurement normalizer preserves effective-dated binding, quality and replay idempotency.
 */
@Injectable()
export class MqttStateHandler implements NormalizationHandler, OnModuleInit {
  readonly name = 'mqtt-state';

  constructor(
    private readonly registry: NormalizationHandlerRegistry,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  supports(envelope: CanonicalEnvelope): boolean {
    return (
      envelope.sourceType === 'mqtt' &&
      envelope.kind === 'state' &&
      envelope.operation !== 'retract'
    );
  }

  async handle(input: NormalizationInput): Promise<NormalizationResult> {
    const { envelope } = input;
    if (envelope.sourceControls?.mqtt?.availability !== true) {
      return this.recordState(input);
    }
    const available = envelope.values?.state?.value === 'ONLINE';
    await this.dataSource.transaction((manager) =>
      this.recordAvailability(manager, envelope, available),
    );
    return {
      status: 'applied',
      outcome: available ? 'source_available' : 'source_unavailable',
      canonicalEventId: null,
      detail: { observedAt: envelope.observedAt },
    };
  }

  private async recordState(
    input: NormalizationInput,
  ): Promise<NormalizationResult> {
    const state = input.envelope.values?.state;
    if (!state)
      return {
        status: 'quarantined',
        outcome: 'processing_failed',
        errorCode: 'processing_failed',
        detail: { reason: 'State observation has no state value' },
      };
    const envelope: CanonicalEnvelope = {
      ...input.envelope,
      kind: 'measurement',
      values: {
        sample: {
          signalRef: state.stateRef,
          value: String(state.value),
          unit: null,
          sequence: state.sequence,
          semanticType: 'state',
        },
      },
    };
    const handler = this.registry.find(envelope);
    if (!handler)
      return {
        status: 'quarantined',
        outcome: 'processing_failed',
        errorCode: 'processing_failed',
        detail: { reason: 'Measurement normalizer is unavailable' },
      };
    return handler.handle({ ...input, envelope });
  }

  private async recordAvailability(
    manager: EntityManager,
    envelope: CanonicalEnvelope,
    available: boolean,
  ): Promise<void> {
    const piConnected = envelope.sourceControls?.mqtt?.piConnected;
    const health = {
      sourceAvailable: available,
      lastAvailabilityAt: envelope.observedAt,
      sourcePiConnected: typeof piConnected === 'boolean' ? piConnected : null,
    };
    await manager.query(
      `UPDATE "ingestion_jobs" SET "health" = coalesce("health", '{}'::jsonb) || $3::jsonb, "updated_at" = now()
        WHERE "connection_id" = $1 AND "scope"->>'mode' = $2 AND "state" <> 'stopped'`,
      [envelope.connectionId, SUBSCRIBE_MODE, JSON.stringify(health)],
    );
    await enqueueOutbox(manager, [
      {
        tenantId: envelope.tenantId,
        aggregateType: 'integration_connection',
        aggregateId: envelope.connectionId,
        type: SOURCE_HEALTH_CHANGED,
        payload: {
          connectionId: envelope.connectionId,
          available,
          observedAt: envelope.observedAt,
          topic: envelope.location.sourcePath,
          piConnected: health.sourcePiConnected,
          retained: envelope.sourceControls?.mqtt?.retained === true,
        },
        scope: envelope.connectionId,
      },
    ]);
  }
}
