import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventRevisionService } from '../../production-event/revisions/event-revision.service';
import { CONNECTOR_ACTOR } from '../../production-event/revisions/revision-actor';
import { CanonicalEnvelope } from '../envelope/canonical-envelope';
import {
  NormalizationHandler,
  NormalizationHandlerRegistry,
  NormalizationInput,
  NormalizationResult,
} from './normalization-handler';

/**
 * Source retractions (ING01, operation `retract`) of any connector: the canonical event linked to the
 * source object is tombstoned through the plan 1.2 revision path (never deleted; idempotent).
 */
@Injectable()
export class RetractionHandler implements NormalizationHandler, OnModuleInit {
  readonly name = 'retraction';

  constructor(
    private readonly registry: NormalizationHandlerRegistry,
    private readonly revisions: EventRevisionService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  supports(envelope: CanonicalEnvelope): boolean {
    return envelope.operation === 'retract';
  }

  async handle(input: NormalizationInput): Promise<NormalizationResult> {
    if (!input.canonicalEventId) {
      return {
        status: 'applied',
        outcome: 'nothing_to_retract',
        canonicalEventId: null,
      };
    }
    await this.revisions.retract(
      input.canonicalEventId,
      CONNECTOR_ACTOR,
      input.envelope.retraction?.reason ?? 'retracted by the source',
      input.envelope.sourceRevision ?? undefined,
    );
    return {
      status: 'applied',
      outcome: 'retracted',
      canonicalEventId: input.canonicalEventId,
    };
  }
}
