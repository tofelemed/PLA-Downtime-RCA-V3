import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DeclaredFigures } from '../../../../domain/events/declared-figures';
import { CreateProductionEventDto } from '../../../../production-event/dto/create-production-event.dto';
import { ProductionEventService } from '../../../../production-event/production-event.service';
import { EventRevisionService } from '../../../../production-event/revisions/event-revision.service';
import { CONNECTOR_ACTOR } from '../../../../production-event/revisions/revision-actor';
import { CanonicalEnvelope } from '../../../envelope/canonical-envelope';
import {
  NormalizationHandler,
  NormalizationHandlerRegistry,
  NormalizationInput,
  NormalizationResult,
} from '../../../normalization/normalization-handler';
import { declaredFiguresOf } from './pla-declared-figures';
import { MQTT_SOURCE_SYSTEM } from './mqtt-interval-event.handler';

/** True for a plant production day decoded by a PLA feed (plans/MQTT_FEEDS.md). */
export function isPlaFeed(envelope: CanonicalEnvelope): boolean {
  return envelope.sourceControls?.mqtt?.feed === 'pla';
}

const DESCRIPTION = 'Production loss declared by the plant (PLA feed)';

type Outcome = 'created' | 'updated' | 'unchanged';

function quarantined(
  errorCode: 'schema_invalid' | 'mapping_invalid_target' | 'order_conflict',
  reason: string,
): NormalizationResult {
  return {
    status: 'quarantined',
    outcome: 'unmapped',
    errorCode,
    detail: { reason },
  };
}

/**
 * Normaliser of PLA-feed days (declared mode): the plant-day message becomes ONE `production_loss` event
 * on the feed's unit, whose quantity is OT's declared shortfall and whose `declaredFigures` keep the
 * planned / actual figures and their provenance. Source MQTT, event id `pla:<event_id>`; a later
 * `event_revision` is a source revision (figures replaced, the coding a person gave survives). Nothing is
 * booked as an external report any more.
 */
@Injectable()
export class MqttPlaFeedHandler implements NormalizationHandler, OnModuleInit {
  readonly name = 'mqtt-pla-feed';

  constructor(
    private readonly registry: NormalizationHandlerRegistry,
    private readonly lifecycle: ProductionEventService,
    private readonly revisions: EventRevisionService,
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
      isPlaFeed(envelope)
    );
  }

  async handle(input: NormalizationInput): Promise<NormalizationResult> {
    const { envelope } = input;
    const unitId = envelope.location.unitId;
    if (!unitId || !envelope.startTime || !envelope.endTime) {
      return quarantined('mapping_invalid_target', 'PLA feed has no unit');
    }
    const declared = declaredFiguresOf(envelope);
    if ('reason' in declared)
      return quarantined('schema_invalid', declared.reason);
    if (!(await this.unitExists(envelope.tenantId, unitId))) {
      return quarantined(
        'mapping_invalid_target',
        'The PLA feed unit is not a unit of this plant; set it on the feed',
      );
    }
    try {
      const stored = await this.store(envelope, unitId, declared.figures);
      return {
        status: 'applied',
        outcome: stored.outcome,
        canonicalEventId: stored.id,
        detail: { outcome: stored.outcome },
      };
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        return quarantined('order_conflict', error.message);
      }
      // the declared figures break a rule of the production loss kind: fix the feed, then replay
      if (error instanceof UnprocessableEntityException) {
        return quarantined('mapping_invalid_target', error.message);
      }
      throw error;
    }
  }

  private async unitExists(tenantId: string, unitId: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM "units" WHERE "id" = $1 AND "tenant_id" = $2`,
      [unitId, tenantId],
    );
    return rows.length > 0;
  }

  /** Known event id → source revision (coding stays); new → create. */
  private async store(
    envelope: CanonicalEnvelope,
    unitId: string,
    figures: DeclaredFigures,
  ): Promise<{ id: string; outcome: Outcome }> {
    const eventId = envelope.sourceObjectId;
    const fields = {
      eventType: 'ProductionLoss',
      startTime: String(envelope.startTime),
      endTime: String(envelope.endTime),
      description: DESCRIPTION,
      quantity: figures.shortfall,
      quantityUom: figures.uom,
      declaredFigures: figures,
    };
    const [existing] = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT "id" FROM "production_events" WHERE "event_id" = $1 AND "tenant_id" = $2`,
      [eventId, envelope.tenantId],
    );
    if (existing) {
      const result = await this.revisions.applySourceRevision(
        existing.id,
        fields,
        {
          actorKind: 'connector',
          sourceRevision: envelope.sourceRevision ?? undefined,
        },
      );
      return {
        id: existing.id,
        outcome: result === 'revised' ? 'updated' : 'unchanged',
      };
    }
    const created = await this.lifecycle.create(
      {
        ...fields,
        tenantId: envelope.tenantId,
        eventId,
        source: MQTT_SOURCE_SYSTEM,
        unitId,
        classification: { physicalType: 'production_loss' },
      } as unknown as CreateProductionEventDto,
      CONNECTOR_ACTOR,
    );
    return { id: created.id, outcome: 'created' };
  }
}
