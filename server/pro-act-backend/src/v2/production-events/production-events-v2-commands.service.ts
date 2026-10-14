import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { Clock } from '../../common/clock/clock';
import { assertRevision } from '../../common/concurrency/revision';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import {
  EventClassification,
  OeeComponent,
  ScheduleClass,
} from '../../domain/events/event-classification';
import {
  applyCodeDefaults,
  CodeDrivenAxis,
} from '../../code-library/classification-basis';
import { CodeDefaultsService } from '../../code-library/code-defaults.service';
import {
  assertWrittenNotInFuture,
  EventWriteInput,
  IntervalModelFields,
  prepareCreate,
  prepareUpdate,
} from '../../production-event/event-write-model';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { ProductionEventService } from '../../production-event/production-event.service';
import { EventRevisionService } from '../../production-event/revisions/event-revision.service';
import { actorFromContext } from '../../production-event/revisions/revision-actor';
import { FailureDictionaryValidator } from '../../reliability/failure-dictionary/failure-dictionary.validator';
import { RuleClassificationService } from '../../rules/rule-classification.service';
import { EventReferencesValidator } from './event-references.validator';
import { failureColumns } from './failure-detail';
import { assertPlannedEnd, plannedEndColumn } from './planned-end';
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
    private readonly lifecycle: ProductionEventService,
    private readonly references: EventReferencesValidator,
    private readonly revisions: EventRevisionService,
    private readonly codeDefaults: CodeDefaultsService,
    private readonly ruleDefaults: RuleClassificationService,
    private readonly clock: Clock,
    private readonly failureCodes: FailureDictionaryValidator,
  ) {}

  /** Creates a manual event in the caller's tenant; returns its id. */
  async create(
    context: RequestContext,
    dto: CreateProductionEventV2Dto,
  ): Promise<string> {
    const tenantId = requireTenantId(context);
    await this.references.assertUnitOwned(tenantId, dto.unitId);
    await this.references.assertOwned(tenantId, dto.unitId, dto);
    await this.failureCodes.assertCodes({
      tenantId,
      assetId: dto.assetId ?? null,
      at: new Date(dto.startTime),
      values: dto,
    });
    const coded = await this.withRuleDefaults(
      tenantId,
      dto,
      await this.withCodeDefaults(tenantId, dto, new Date(dto.startTime)),
    );
    const fields = prepareCreate({
      ...writeInput(coded.dto),
      eventType: dto.eventType,
      source: MANUAL_SOURCE,
    });
    assertImpact(fields, dto.impactFraction);
    assertPlannedEnd(fields.startTime, dto.plannedEndTime);
    assertWrittenNotInFuture(fields, this.clock.now());
    const id = randomUUID();
    const event = this.events.create({
      ...editableColumns(dto),
      ...coded.columns,
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
    const saved = await this.revisions.createEvent(
      event,
      actorFromContext(context),
    );
    await this.lifecycle.publishCreated(saved);
    return id;
  }

  /**
   * Applies user fields when the stored revision is `expectedRevision` (412 otherwise). Source-owned
   * events keep their interval: only manual events accept start/end changes (409 SOURCE_OWNED). The
   * write is a user revision (plan 1.2): coding revision, effective revision, source overrides.
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
      throw notFound();
    }
    assertRevision(existing.rowVersion, expectedRevision);
    await this.references.assertOwned(tenantId, existing.unitId, dto);
    await this.failureCodes.assertCodes({
      tenantId,
      assetId: dto.assetId === undefined ? existing.assetId : dto.assetId,
      at: dto.startTime ? new Date(dto.startTime) : existing.startTime,
      values: dto,
    });
    assertIntervalEditable(existing, dto);
    const coded = await this.withCodeDefaults(
      tenantId,
      dto,
      existing.startTime,
    );
    const now = this.clock.now();
    const updated = await this.revisions.applyUserChange({
      actor: actorFromContext(context),
      eventId: id,
      tenantId,
      expectedRowVersion: expectedRevision,
      patch: (locked) => ({
        ...patchColumns(locked, coded.dto, now),
        ...withoutKeptImpactCode(locked, coded.columns),
      }),
    });
    if (!updated) {
      throw notFound();
    }
    this.lifecycle.publishUpdated(updated);
  }

  /**
   * Plan 1.3 step 5: a reason code brings its classification defaults (the `code_mapping_rules` version
   * in force at the event start, else the code's default columns). Values the caller sent win and are
   * flagged as overrides in `classification_basis`.
   */
  private async withCodeDefaults<T extends ProductionEventV2EditableDto>(
    tenantId: string,
    dto: T,
    at: Date,
  ): Promise<{ dto: T; columns: Partial<ProductionEvent> }> {
    if (!dto.reasonCodeId) return { dto, columns: {} };
    const defaults = await this.codeDefaults.defaultsFor(
      tenantId,
      dto.reasonCodeId,
      at,
    );
    const { values, basis } = applyCodeDefaults(defaults, {
      scheduleClass: dto.scheduleClass,
      oeeComponent: dto.oeeComponent,
    });
    const columns: Partial<ProductionEvent> = {
      classificationBasis: Object.keys(basis).length > 0 ? basis : null,
    };
    if (values.impactCodeId) columns.impactCodeId = values.impactCodeId;
    return {
      dto: {
        ...dto,
        scheduleClass:
          dto.scheduleClass ??
          (values.scheduleClass as ScheduleClass | undefined),
        oeeComponent:
          dto.oeeComponent ?? (values.oeeComponent as OeeComponent | undefined),
      },
      columns,
    };
  }

  /**
   * Plan 3.8: active `coding_default` rules fill the axes the user and the reason code left open
   * (schedule class, OEE component, impact code); each filled axis records its rule version.
   */
  private async withRuleDefaults(
    tenantId: string,
    dto: CreateProductionEventV2Dto,
    coded: {
      dto: CreateProductionEventV2Dto;
      columns: Partial<ProductionEvent>;
    },
  ): Promise<{
    dto: CreateProductionEventV2Dto;
    columns: Partial<ProductionEvent>;
  }> {
    const draft = prepareCreate({
      ...writeInput(coded.dto),
      eventType: dto.eventType,
      source: MANUAL_SOURCE,
    });
    const open = new Set<CodeDrivenAxis>();
    if (coded.dto.scheduleClass === undefined) open.add('scheduleClass');
    if (coded.dto.oeeComponent === undefined) open.add('oeeComponent');
    if (!coded.columns.impactCodeId) open.add('impactCodeId');
    const ruled = await this.ruleDefaults.fillOpenAxes(
      tenantId,
      {
        ...draft,
        eventType: dto.eventType,
        source: MANUAL_SOURCE,
        reasonCodeId: dto.reasonCodeId,
        impactCodeId: coded.columns.impactCodeId,
        unitId: dto.unitId,
        assetId: dto.assetId,
      },
      open,
    );
    const { scheduleClass, oeeComponent, impactCodeId } = ruled.values;
    if (!scheduleClass && !oeeComponent && !impactCodeId) return coded;
    return {
      dto: {
        ...coded.dto,
        scheduleClass:
          (scheduleClass as ScheduleClass | undefined) ??
          coded.dto.scheduleClass,
        oeeComponent:
          (oeeComponent as OeeComponent | undefined) ?? coded.dto.oeeComponent,
      },
      columns: {
        ...coded.columns,
        ...(impactCodeId ? { impactCodeId } : {}),
        classificationBasis: {
          ...(coded.columns.classificationBasis ?? {}),
          ...ruled.basis,
        },
      },
    };
  }
}

/** 409 SOURCE_OWNED: only manual events accept start/end changes. */
function assertIntervalEditable(
  existing: ProductionEvent,
  dto: PatchProductionEventV2Dto,
): void {
  if (
    existing.sourceKind !== 'manual' &&
    INTERVAL_FIELDS.some((field) => dto[field] !== undefined)
  ) {
    throw new ConflictException({
      code: 'SOURCE_OWNED',
      message: 'The interval of a source event is owned by its source system',
    });
  }
}

/** An existing impact code is never replaced by a reason default (only an empty one is filled). */
function withoutKeptImpactCode(
  locked: ProductionEvent,
  columns: Partial<ProductionEvent>,
): Partial<ProductionEvent> {
  if (!locked.impactCodeId || columns.impactCodeId === undefined)
    return columns;
  const rest = { ...columns };
  delete rest.impactCodeId;
  return rest;
}

/**
 * Columns of a PATCH against the locked row; 422 INVALID_IMPACT on an inconsistent impact, 422 IN_FUTURE
 * when a changed interval reaches into the future.
 */
function patchColumns(
  locked: ProductionEvent,
  dto: PatchProductionEventV2Dto,
  now: Date,
): Partial<ProductionEvent> {
  const fields = prepareUpdate(locked, writeInput(dto));
  if (INTERVAL_FIELDS.some((field) => dto[field] !== undefined))
    assertWrittenNotInFuture(fields, now);
  assertImpact(
    fields,
    dto.impactFraction === undefined
      ? locked.impactFraction
      : dto.impactFraction,
  );
  assertPlannedEnd(
    fields.startTime,
    dto.plannedEndTime === undefined
      ? locked.plannedEndTime
      : dto.plannedEndTime,
  );
  return { ...editableColumns(dto), ...fields } as Partial<ProductionEvent>;
}

function notFound(): NotFoundException {
  return new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
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
    originUnitId: dto.originUnitId,
    originAssetId: dto.originAssetId,
    reasonCodeId: dto.reasonCodeId,
    description: dto.description,
    quantity: dto.quantity,
    quantityUom: dto.quantityUom,
    cost: dto.cost,
    impactFraction: dto.impactFraction,
    plannedEndTime: plannedEndColumn(dto.plannedEndTime),
    ...failureColumns(dto),
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
