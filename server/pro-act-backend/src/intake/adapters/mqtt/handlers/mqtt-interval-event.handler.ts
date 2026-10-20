import { Injectable, OnModuleInit } from '@nestjs/common';
import { AttributeMappingService } from '../../../../attribute-mapping/attribute-mapping.service';
import {
  FrameContext,
  FrameResult,
  PiFrameIngestService,
} from '../../../../integration/pi-frame-ingest.service';
import { SourceMappingService } from '../../../../source-mapping/source-mapping.service';
import { CanonicalEnvelope } from '../../../envelope/canonical-envelope';
import { IngestionErrorCode } from '../../../entities/ingestion-exception.entity';
import {
  NormalizationHandler,
  NormalizationHandlerRegistry,
  NormalizationInput,
  NormalizationResult,
} from '../../../normalization/normalization-handler';
import { unresolvedReason } from '../../../../integration/unresolved-reason';
import { mqttFrameOf } from './mqtt-frame';

/** Source system of the mappings this handler resolves against (`source_mappings.source_system`). */
export const MQTT_SOURCE_SYSTEM = 'MQTT';

/** Placement failures → quarantine codes (design §4.2 stage 5: an unmapped element is parked, never auto-created). */
const PLACEMENT_CODE: Readonly<
  Record<NonNullable<FrameResult['placement']>['status'], IngestionErrorCode>
> = {
  unmapped: 'unknown_template',
  ambiguous: 'mapping_ambiguous',
  invalid_target: 'mapping_invalid_target',
};

/**
 * Normaliser of MQTT interval events (plan 1.8 WP3 step 3, design §5 `DowntimeEventHandler`): the
 * retained contract event goes through the PI frame path — typed attribute mapping by template →
 * `MasterDataCodeResolverService` → placement by `source_mappings` (`source_system = MQTT`) →
 * `ProductionEventService.create` or `EventRevisionService.applySourceRevision` (end time, attribute
 * changes; an older revision was already refused by intake). Deletes are `RetractionHandler`'s.
 * An unmapped reason the profile kept (`reasonUnmapped: keep`) creates the event uncoded and leaves an
 * `unknown_code` row linked to it, so the stop is never lost.
 */
@Injectable()
export class MqttIntervalEventHandler
  implements NormalizationHandler, OnModuleInit
{
  readonly name = 'mqtt-interval-event';

  constructor(
    private readonly registry: NormalizationHandlerRegistry,
    private readonly ingest: PiFrameIngestService,
    private readonly attributeMappings: AttributeMappingService,
    private readonly sourceMappings: SourceMappingService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  supports(envelope: CanonicalEnvelope): boolean {
    return (
      envelope.sourceType === 'mqtt' &&
      envelope.kind === 'interval_event' &&
      envelope.operation !== 'retract'
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
        errorCode: PLACEMENT_CODE[result.placement.status],
        detail: {
          reason: `No MQTT source mapping places element path "${envelope.location.sourcePath}"`,
          placement: result.placement,
          diagnostics: result.diagnostics,
          sourcePath: envelope.location.sourcePath,
          templateName: envelope.values?.templateName ?? null,
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

  /** The tenant's current profile and MQTT resolver: a mapping added later flows without a restart. */
  private async contextFor(envelope: CanonicalEnvelope): Promise<FrameContext> {
    const { tenantId, connectionId } = envelope;
    const at = new Date(envelope.observedAt);
    return {
      tenantId,
      sourceSystem: MQTT_SOURCE_SYSTEM,
      profile: await this.attributeMappings.loadProfile(
        tenantId,
        connectionId,
        at,
      ),
      resolver: await this.sourceMappings.loadResolver(
        tenantId,
        connectionId,
        at,
        MQTT_SOURCE_SYSTEM,
      ),
    };
  }
}
