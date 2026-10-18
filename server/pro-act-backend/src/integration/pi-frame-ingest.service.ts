import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MappingDiagnostic } from '../attribute-mapping/attribute-conversion';
import { mapAttributes } from '../attribute-mapping/attribute-mapper';
import { MappingProfile } from '../attribute-mapping/attribute-mapping.service';
import {
  applyCodeDefaults,
  ClassificationBasis,
} from '../code-library/classification-basis';
import { CodeDefaultsService } from '../code-library/code-defaults.service';
import { EventClassification } from '../domain/events/event-classification';
import { CreateProductionEventDto } from '../production-event/dto/create-production-event.dto';
import { prepareCreate } from '../production-event/event-write-model';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ProductionEventService } from '../production-event/production-event.service';
import {
  EventFacts,
  SOURCE_COLUMN_FIELDS,
} from '../production-event/revisions/event-facts';
import { EventRevisionService } from '../production-event/revisions/event-revision.service';
import { CONNECTOR_ACTOR } from '../production-event/revisions/revision-actor';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { RuleClassificationService } from '../rules/rule-classification.service';
import {
  ActiveCodingRule,
  filledClassification,
  fillOpenAxes,
  openAxesOf,
  withRuleBasis,
} from '../rules/rule-defaults';
import {
  ResolvedMapping,
  TenantMappingResolver,
} from '../source-mapping/source-mapping.service';
import { MasterDataCodeResolverService } from './master-data-code-resolver.service';
import { NO_TEMPLATE_KEY } from './pi-event-mapper';
import { PiUnmappedRecorder } from './pi-unmapped-recorder';
import { piEndTime, piEndTimeIso } from './pi/pi-time';

/** The fields of a PI event frame the bridge reads. */
export interface PiEventFrame {
  WebId: string;
  Name?: string | null;
  TemplateName?: string | null;
  StartTime: string;
  EndTime?: string | null;
  Path?: string | null;
  PrimaryReferencedElement?: {
    WebId?: string | null;
    Path?: string | null;
  } | null;
  /** referenced elements beyond the primary one, when PI supplies them */
  RefElementWebIds?: string[] | null;
  /** ancestors of the primary element (closest first), added by the adapter (plan 1.6) */
  AncestorElementWebIds?: string[] | null;
  /** the source's own version marker of this frame (MQTT `revision`); PI frames use the end time */
  SourceRevision?: string | null;
}

/**
 * Everything loaded once per pull: the tenant, its mapping profile and its mapping resolver.
 * `sourceSystem` names the connector the frames come from (`production_events.source`,
 * `unmapped_events.source_system`); PI unless the caller says otherwise (MQTT reuses this path, plan 1.8).
 */
export interface FrameContext {
  tenantId: string;
  organizationId?: string;
  profile: MappingProfile;
  resolver: TenantMappingResolver;
  sourceSystem?: 'PI' | 'MQTT';
}

export type FrameOutcome = 'created' | 'updated' | 'unchanged' | 'unmapped';

export interface FrameResult {
  outcome: FrameOutcome;
  diagnostics: MappingDiagnostic[];
  /** the production event the frame created or revised (absent when unmapped) */
  eventId?: string;
  /** why an unmapped frame could not be placed, with the ambiguity candidates */
  placement?: Exclude<ResolvedMapping, { status: 'mapped' }>;
}

/** One frame after typed attribute mapping and code resolution, before it is placed. */
interface MappedFrame {
  templateName: string;
  eventType: string;
  start: Date;
  end: Date | null;
  dto: Record<string, unknown>;
  facts: EventFacts;
  diagnostics: MappingDiagnostic[];
}

/**
 * PI event frame → production event (plan 1.3): typed attribute mapping over the field catalog (ING04),
 * exact code resolution, deterministic hierarchy mapping (ING03; unmapped and ambiguous frames are
 * quarantined in `unmapped_events` with the reason and the candidates), code-rule classification
 * defaults and then the active `coding_default` rules (plan 3.8) on create, and source revisions for
 * known events (plan 1.2).
 */
@Injectable()
export class PiFrameIngestService {
  /** Active rules per frame context: loaded once per PI pull (or MQTT message), never per frame. */
  private readonly batchRules = new WeakMap<
    FrameContext,
    Promise<ActiveCodingRule[]>
  >();

  constructor(
    @InjectRepository(ProductionEvent)
    private readonly events: Repository<ProductionEvent>,
    @InjectRepository(ProductionPlan)
    private readonly plans: Repository<ProductionPlan>,
    private readonly lifecycle: ProductionEventService,
    private readonly revisions: EventRevisionService,
    private readonly codes: MasterDataCodeResolverService,
    private readonly codeDefaults: CodeDefaultsService,
    private readonly quarantine: PiUnmappedRecorder,
    private readonly ruleDefaults: RuleClassificationService,
  ) {}

  async ingest(
    context: FrameContext,
    frame: PiEventFrame,
    attributes: Readonly<Record<string, unknown>>,
  ): Promise<FrameResult> {
    const mapped = await this.mapFrame(context, frame, attributes);
    const placement = context.resolver.resolve({
      sourceId: frame.PrimaryReferencedElement?.WebId || frame.WebId,
      sourcePath: frame.PrimaryReferencedElement?.Path || frame.Path,
      afElementWebIds: elementWebIds(frame),
    });
    if (placement.status !== 'mapped') {
      await this.quarantine.record(context, frame, {
        attributes,
        mapped,
        placement,
      });
      return {
        outcome: 'unmapped',
        diagnostics: mapped.diagnostics,
        placement,
      };
    }
    const dto: Record<string, unknown> = {
      ...mapped.dto,
      unitId: placement.unitId,
      assetId: placement.assetId ?? undefined,
      planId: await this.planIdFor(context.tenantId, placement.unitId, mapped),
    };
    const facts: EventFacts = {
      ...mapped.facts,
      mappingDiagnostics: mapped.diagnostics,
    };
    const stored = await this.store(context, dto, facts, {
      end: mapped.end,
      sourceRevision: frame.SourceRevision ?? null,
    });
    return { ...stored, diagnostics: mapped.diagnostics };
  }

  private async mapFrame(
    context: FrameContext,
    frame: PiEventFrame,
    attributes: Readonly<Record<string, unknown>>,
  ): Promise<MappedFrame> {
    const templateName = frame.TemplateName || NO_TEMPLATE_KEY;
    const start = new Date(frame.StartTime);
    // PI03: the open-frame sentinel is "still open", never an end time
    const end = piEndTime(frame.EndTime);
    const typed = mapAttributes(
      context.profile.rulesFor(templateName),
      attributes,
      { start, end },
    );
    const codes = await this.codes.resolveFacts(
      context.tenantId,
      typed.facts,
      start,
    );
    const eventType = context.profile.eventTypeOf(templateName);
    const dto: Record<string, unknown> = {
      ...frameColumns(context, frame, eventType),
      ...typed.columns,
      ...codes.ids,
      description:
        typed.columns.description ??
        frame.Name ??
        `Event from ${sourceSystemOf(context)}`,
    };
    return {
      templateName,
      eventType,
      start,
      end,
      dto,
      facts: typed.facts,
      diagnostics: [...typed.diagnostics, ...codes.diagnostics],
    };
  }

  /** Known event → source revision (codes are taken on create only, plan 1.2); new → create. */
  private async store(
    context: FrameContext,
    dto: Record<string, unknown>,
    facts: EventFacts,
    version: { end: Date | null; sourceRevision: string | null },
  ): Promise<{ outcome: FrameOutcome; eventId: string }> {
    const existing = await this.events.findOne({
      where: { eventId: String(dto.eventId), tenantId: context.tenantId },
      select: { id: true },
    });
    if (existing) {
      const outcome = await this.revisions.applySourceRevision(
        existing.id,
        { ...sourceColumnsOf(dto), ...facts },
        {
          actorKind: 'connector',
          sourceRevision: version.sourceRevision ?? version.end?.toISOString(),
        },
      );
      return {
        outcome: outcome === 'revised' ? 'updated' : 'unchanged',
        eventId: existing.id,
      };
    }
    const classified = await this.withRuleDefaults(
      context,
      await this.withCodeDefaults(context.tenantId, dto),
    );
    const created = await this.lifecycle.create(
      classified as unknown as CreateProductionEventDto,
      CONNECTOR_ACTOR,
      facts,
    );
    return { outcome: 'created', eventId: created.id };
  }

  /** Classification defaults of the resolved reason code (rule in force at the event start). */
  private async withCodeDefaults(
    tenantId: string,
    dto: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (typeof dto.reasonCodeId !== 'string') return dto;
    const defaults = await this.codeDefaults.defaultsFor(
      tenantId,
      dto.reasonCodeId,
      new Date(String(dto.startTime)),
    );
    const { values, basis } = applyCodeDefaults(defaults, {
      impactCodeId: dto.impactCodeId as string | undefined,
    });
    const { impactCodeId, ...classification } = values;
    return {
      ...dto,
      ...(impactCodeId ? { impactCodeId } : {}),
      classification,
      classificationBasis: Object.keys(basis).length > 0 ? basis : null,
    };
  }

  /**
   * Plan 3.8: the tenant's active `coding_default` rules fill the axes the source and the reason code
   * left open, each with its `declarative_rule` basis (a default, never a user override).
   */
  private async withRuleDefaults(
    context: FrameContext,
    dto: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const classification = (dto.classification ??
      {}) as Partial<EventClassification>;
    const impactCodeId = dto.impactCodeId as string | undefined;
    const open = openAxesOf({ ...classification, impactCodeId });
    if (open.size === 0) return dto;
    const rules = await this.rulesFor(context);
    if (rules.length === 0) return dto;
    const draft = prepareCreate(dto);
    const fill = fillOpenAxes(
      rules,
      {
        ...draft,
        eventType: dto.eventType as string,
        source: sourceSystemOf(context),
        reasonCodeId: dto.reasonCodeId as string | undefined,
        impactCodeId,
        unitId: String(dto.unitId),
        assetId: dto.assetId as string | undefined,
      },
      open,
    );
    if (Object.keys(fill.basis).length === 0) return dto;
    return {
      ...dto,
      ...(fill.values.impactCodeId
        ? { impactCodeId: fill.values.impactCodeId }
        : {}),
      classification: { ...classification, ...filledClassification(fill) },
      classificationBasis: withRuleBasis(
        dto.classificationBasis as ClassificationBasis | null | undefined,
        fill,
      ),
    };
  }

  private rulesFor(context: FrameContext): Promise<ActiveCodingRule[]> {
    const cached = this.batchRules.get(context);
    if (cached) return cached;
    const loading = this.ruleDefaults.activeRules(context.tenantId);
    this.batchRules.set(context, loading);
    loading.catch(() => this.batchRules.delete(context));
    return loading;
  }

  private async planIdFor(
    tenantId: string,
    unitId: string,
    mapped: MappedFrame,
  ): Promise<string | undefined> {
    if (
      mapped.eventType !== 'ProductionLoss' &&
      mapped.eventType !== 'ProductionOutput'
    ) {
      return undefined;
    }
    const plan = await this.plans
      .createQueryBuilder('plan')
      .select(['plan.id'])
      .where('plan.unitId = :unitId AND plan.tenantId = :tenantId', {
        unitId,
        tenantId,
      })
      .andWhere('plan.startDate <= :at AND plan.endDate >= :at', {
        at: mapped.start,
      })
      .orderBy('plan.startDate', 'DESC')
      .getOne();
    return plan?.id;
  }
}

/** Columns every source event carries, from the frame itself. */
function frameColumns(
  context: FrameContext,
  frame: PiEventFrame,
  eventType: string,
): Record<string, unknown> {
  return {
    tenantId: context.tenantId,
    organizationId: context.organizationId,
    eventId: frame.WebId,
    eventType,
    source: sourceSystemOf(context),
    startTime: new Date(frame.StartTime).toISOString(),
    endTime: piEndTimeIso(frame.EndTime) ?? undefined,
  };
}

export function sourceSystemOf(context: FrameContext): 'PI' | 'MQTT' {
  return context.sourceSystem ?? 'PI';
}

/** The PI element first, then further referenced elements, then the primary's ancestors. */
function elementWebIds(frame: PiEventFrame): string[] {
  const primary = frame.PrimaryReferencedElement?.WebId;
  return [
    ...(primary ? [primary] : []),
    ...(frame.RefElementWebIds ?? []),
    ...(frame.AncestorElementWebIds ?? []),
  ];
}

/** The column-backed source fields of a PI event DTO (open frames deliver no end time: it stays open). */
function sourceColumnsOf(
  dto: Record<string, unknown>,
): Record<string, unknown> {
  const facts: Record<string, unknown> = {};
  for (const field of SOURCE_COLUMN_FIELDS) {
    facts[field] = dto[field];
  }
  return facts;
}
