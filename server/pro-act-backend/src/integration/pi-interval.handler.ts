import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttributeMappingService } from '../attribute-mapping/attribute-mapping.service';
import { CanonicalEnvelope } from '../intake/envelope/canonical-envelope';
import { IngestionErrorCode } from '../intake/entities/ingestion-exception.entity';
import {
  NormalizationHandler,
  NormalizationHandlerRegistry,
  NormalizationInput,
  NormalizationResult,
} from '../intake/normalization/normalization-handler';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { SourceMappingService } from '../source-mapping/source-mapping.service';
import { piPayloadOf } from './pi-envelope';
import {
  FrameContext,
  FrameResult,
  PiFrameIngestService,
} from './pi-frame-ingest.service';

/** Inline callers (the PI pull) pass the mapping context they loaded once per pull. */
export interface PiNormalizationHints {
  frameContext: FrameContext;
}

const ERROR_CODE: Readonly<
  Record<NonNullable<FrameResult['placement']>['status'], IngestionErrorCode>
> = {
  unmapped: 'unknown_unit',
  ambiguous: 'mapping_ambiguous',
  invalid_target: 'mapping_invalid_target',
};

/**
 * Normaliser of PI event frames (plan 1.5 → 1.2/1.3): the retained frame goes through the existing
 * typed mapping, hierarchy resolution and source revision path (`PiFrameIngestService`). A frame that
 * cannot be placed is quarantined (`unknown_unit`, `mapping_ambiguous`, `mapping_invalid_target`); it is
 * also mirrored into `unmapped_events` so the v1 screens keep showing it.
 */
@Injectable()
export class PiIntervalHandler implements NormalizationHandler, OnModuleInit {
  readonly name = 'pi-event-frame';

  constructor(
    private readonly registry: NormalizationHandlerRegistry,
    private readonly ingest: PiFrameIngestService,
    private readonly attributeMappings: AttributeMappingService,
    private readonly sourceMappings: SourceMappingService,
    @InjectRepository(PIConnection)
    private readonly piConnections: Repository<PIConnection>,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  supports(envelope: CanonicalEnvelope): boolean {
    return (
      envelope.sourceType === 'pi_web_api' &&
      envelope.kind === 'interval_event' &&
      envelope.operation !== 'retract'
    );
  }

  async handle(input: NormalizationInput): Promise<NormalizationResult> {
    const context = await this.contextFor(input);
    const { frame, attributes } = piPayloadOf(input.envelope);
    const result = await this.ingest.ingest(context, frame, attributes);
    if (result.outcome === 'unmapped' && result.placement) {
      return {
        status: 'quarantined',
        outcome: 'unmapped',
        errorCode: ERROR_CODE[result.placement.status],
        detail: {
          placement: result.placement,
          diagnostics: result.diagnostics,
          sourcePath: input.envelope.location.sourcePath,
        },
      };
    }
    return {
      status: 'applied',
      outcome: result.outcome,
      canonicalEventId: result.eventId ?? null,
      detail: { diagnostics: result.diagnostics },
    };
  }

  /** The caller's per-pull context, or the tenant's current profile and resolver (relay, replay). */
  private async contextFor(input: NormalizationInput): Promise<FrameContext> {
    const { tenantId, connectionId } = input.envelope;
    const hinted = (input.hints as PiNormalizationHints | undefined)
      ?.frameContext;
    if (hinted?.tenantId === tenantId) return hinted;
    const connection = await this.piConnections.findOne({
      where: { id: connectionId },
      select: { id: true, organizationId: true },
    });
    return {
      tenantId,
      organizationId: connection?.organizationId,
      profile: await this.attributeMappings.loadProfile(tenantId, connectionId),
      resolver: await this.sourceMappings.loadResolver(tenantId, connectionId),
    };
  }
}
