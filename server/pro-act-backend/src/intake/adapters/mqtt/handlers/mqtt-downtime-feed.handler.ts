import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AttributeMappingService } from '../../../../attribute-mapping/attribute-mapping.service';
import {
  FrameContext,
  PiFrameIngestService,
} from '../../../../integration/pi-frame-ingest.service';
import { unresolvedReason } from '../../../../integration/unresolved-reason';
import { SourceMappingService } from '../../../../source-mapping/source-mapping.service';
import { CanonicalEnvelope } from '../../../envelope/canonical-envelope';
import {
  NormalizationHandler,
  NormalizationHandlerRegistry,
  NormalizationInput,
  NormalizationResult,
} from '../../../normalization/normalization-handler';
import { DowntimePlacement } from '../feeds/downtime-placement';
import { mqttFrameOf } from './mqtt-frame';
import { MQTT_SOURCE_SYSTEM } from './mqtt-interval-event.handler';

/** True for a stop decoded by a downtime feed (plans/MQTT_FEEDS.md). */
export function isDowntimeFeed(envelope: CanonicalEnvelope): boolean {
  return envelope.sourceControls?.mqtt?.feed === 'downtime';
}

const controlText = (
  envelope: CanonicalEnvelope,
  key: string,
): string | null => {
  const value = envelope.sourceControls?.mqtt?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
};

/**
 * Normaliser of downtime-feed stops: placed by an MQTT source mapping or by unit / equipment code
 * (`DowntimePlacement`), then the frame path every connector shares — typed Production Loss mapping,
 * reason code resolution, create or source revision of the event (an end message closes the open stop).
 * An unplaced stop is quarantined `unknown_unit` with the unit code as the path to bind.
 */
@Injectable()
export class MqttDowntimeFeedHandler
  implements NormalizationHandler, OnModuleInit
{
  readonly name = 'mqtt-downtime-feed';

  constructor(
    private readonly registry: NormalizationHandlerRegistry,
    private readonly ingest: PiFrameIngestService,
    private readonly attributeMappings: AttributeMappingService,
    private readonly sourceMappings: SourceMappingService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  supports(envelope: CanonicalEnvelope): boolean {
    return (
      envelope.sourceType === 'mqtt' &&
      envelope.kind === 'interval_event' &&
      envelope.operation !== 'retract' &&
      isDowntimeFeed(envelope)
    );
  }

  async handle(input: NormalizationInput): Promise<NormalizationResult> {
    const { envelope } = input;
    const context = await this.contextFor(envelope);
    const { frame, attributes } = mqttFrameOf(envelope);
    const result = await this.ingest.ingest(context, frame, attributes);
    if (result.outcome === 'unmapped' && result.placement) {
      return {
        status: 'quarantined',
        outcome: 'unmapped',
        errorCode:
          result.placement.status === 'ambiguous'
            ? 'mapping_ambiguous'
            : result.placement.status === 'invalid_target'
              ? 'mapping_invalid_target'
              : 'unknown_unit',
        detail: {
          reason: `No unit with code "${controlText(envelope, 'unit') ?? '—'}" or asset with code "${controlText(envelope, 'equipment') ?? '—'}", and no MQTT source mapping`,
          placement: result.placement,
          diagnostics: result.diagnostics,
          sourcePath: envelope.location.sourcePath,
        },
      };
    }
    const quarantine = unresolvedReason(result, attributes);
    return {
      status: 'applied',
      outcome: result.outcome,
      canonicalEventId: result.eventId ?? null,
      detail: { diagnostics: result.diagnostics },
      ...(quarantine ? { quarantine } : {}),
    };
  }

  private async contextFor(envelope: CanonicalEnvelope): Promise<FrameContext> {
    const { tenantId, connectionId } = envelope;
    const at = new Date(envelope.observedAt);
    const mappings = await this.sourceMappings.loadResolver(
      tenantId,
      connectionId,
      at,
      MQTT_SOURCE_SYSTEM,
    );
    return {
      tenantId,
      sourceSystem: MQTT_SOURCE_SYSTEM,
      profile: await this.attributeMappings.loadProfile(
        tenantId,
        connectionId,
        at,
      ),
      resolver: await DowntimePlacement.load(this.dataSource, {
        tenantId,
        mappings,
        unit: controlText(envelope, 'unit'),
        equipment: controlText(envelope, 'equipment'),
      }),
    };
  }
}
