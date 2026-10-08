import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import {
  assertRevision,
  staleRevision,
} from '../../common/concurrency/revision';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { EventClassification } from '../../domain/events/event-classification';
import {
  EventWriteInput,
  IntervalModelFields,
  prepareCreate,
  prepareUpdate,
} from '../../production-event/event-write-model';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { ProductionEventService } from '../../production-event/production-event.service';
import { Unit } from '../../unit/unit.entity';
import {
  CreateProductionEventV2Dto,
  PatchProductionEventV2Dto,
  ProductionEventV2EditableDto,
} from './production-event-v2-write.dto';

const MANUAL_SOURCE = 'Manual';
const INTERVAL_FIELDS = ['startTime', 'endTime', 'durationSeconds'] as const;

/** Writes of the v2 event resource (DT08 manual create, user edits with `If-Match`). */
@Injectable()
export class ProductionEventsV2CommandService {
  constructor(
    @InjectRepository(ProductionEvent)
    private readonly events: Repository<ProductionEvent>,
    @InjectRepository(Unit)
    private readonly units: Repository<Unit>,
    private readonly lifecycle: ProductionEventService,
  ) {}

  /** Creates a manual event in the caller's tenant; returns its id. */
  async create(
    context: RequestContext,
    dto: CreateProductionEventV2Dto,
  ): Promise<string> {
    const tenantId = requireTenantId(context);
    if ((await this.units.countBy({ id: dto.unitId, tenantId })) === 0) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Unit not found',
      });
    }
    const fields = prepareCreate({
      ...writeInput(dto),
      eventType: dto.eventType,
      source: MANUAL_SOURCE,
    });
    assertImpact(fields, dto.impactFraction);
    const id = randomUUID();
    const event = this.events.create({
      ...editableColumns(dto),
      id,
      canonicalId: id,
      tenantId,
      organizationId: context.organizationId ?? undefined,
      unitId: dto.unitId,
      planId: dto.planId,
      eventId: dto.eventId,
      eventType: dto.eventType,
      source: MANUAL_SOURCE,
      ...fields,
    } as Partial<ProductionEvent>);
    const saved = await this.events.save(event);
    await this.lifecycle.publishCreated(saved);
    return id;
  }

  /**
   * Applies user fields when the stored revision is `expectedRevision` (412 otherwise). Source-owned
   * events keep their interval: only manual events accept start/end changes (409 SOURCE_OWNED).
   */
  async patch(
    context: RequestContext,
    id: string,
    expectedRevision: number,
    dto: PatchProductionEventV2Dto,
  ): Promise<void> {
    const tenantId = requireTenantId(context);
    const existing = await scopedQuery(this.events, 'event', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('event.id = :id', { id })
      .getOne();
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    assertRevision(existing.rowVersion, expectedRevision);
    if (
      existing.sourceKind !== 'manual' &&
      INTERVAL_FIELDS.some((field) => dto[field] !== undefined)
    ) {
      throw new ConflictException({
        code: 'SOURCE_OWNED',
        message: 'The interval of a source event is owned by its source system',
      });
    }
    const fields = prepareUpdate(existing, writeInput(dto));
    assertImpact(
      fields,
      dto.impactFraction === undefined
        ? existing.impactFraction
        : dto.impactFraction,
    );
    const result = await this.events
      .createQueryBuilder()
      .update(ProductionEvent)
      .set({ ...editableColumns(dto), ...fields } as Partial<ProductionEvent>)
      .where(
        'id = :id AND tenant_id = :tenantId AND row_version = :expectedRevision',
        {
          id,
          tenantId,
          expectedRevision,
        },
      )
      .execute();
    if (!result.affected) {
      throw staleRevision();
    }
    const updated = await this.events.findOneBy({ id });
    if (updated) {
      this.lifecycle.publishUpdated(updated);
    }
  }
}

function writeInput(
  dto: ProductionEventV2EditableDto & { startTime?: string },
): EventWriteInput {
  const classification: Partial<EventClassification> = {
    physicalType: dto.physicalType,
    scheduleClass: dto.scheduleClass,
    oeeComponent: dto.oeeComponent,
    impactMode: dto.impactMode,
  };
  return {
    startTime: dto.startTime,
    endTime: dto.endTime,
    durationSeconds: dto.durationSeconds,
    reasonCodeId: dto.reasonCodeId,
    classification,
  };
}

/** Plain columns copied from the body; `undefined` leaves a column untouched, `null` clears it. */
function editableColumns(
  dto: ProductionEventV2EditableDto,
): Partial<ProductionEvent> {
  const columns = {
    assetId: dto.assetId,
    reasonCodeId: dto.reasonCodeId,
    description: dto.description,
    quantity: dto.quantity,
    quantityUom: dto.quantityUom,
    cost: dto.cost,
    impactFraction: dto.impactFraction,
  };
  return Object.fromEntries(
    Object.entries(columns).filter(([, value]) => value !== undefined),
  ) as Partial<ProductionEvent>;
}

/** `fractional` needs a 0..1 fraction; every other impact mode must not carry one. */
function assertImpact(
  fields: IntervalModelFields,
  fraction: string | number | null | undefined,
): void {
  const hasFraction = fraction !== null && fraction !== undefined;
  const value = hasFraction ? Number(fraction) : Number.NaN;
  if (
    fields.impactMode === 'fractional' &&
    (!hasFraction || value < 0 || value > 1)
  ) {
    throw impactError(
      'impactFraction must be between 0 and 1 when impactMode is fractional',
    );
  }
  if (fields.impactMode !== 'fractional' && hasFraction) {
    throw impactError(
      'impactFraction is only allowed when impactMode is fractional',
    );
  }
}

function impactError(message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'INVALID_IMPACT',
    message: [message],
    fieldErrors: [{ field: 'impactFraction', message }],
  });
}
