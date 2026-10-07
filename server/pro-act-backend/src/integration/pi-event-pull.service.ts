import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { PIEvent } from '../pi-event/pi-event.entity';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ProductionEventService } from '../production-event/production-event.service';
import { PIMapping } from '../pi-mapping/pi-mapping.entity';
import { AfBinding } from '../af-binding/af-binding.entity';
import { PISyncWatermark } from '../pi-sync-watermark/pi-sync-watermark.entity';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { HierarchyMappingService } from '../hierarchy-mapping/hierarchy-mapping.service';
import { PIWebApiService } from './pi-web-api.service';
import { MasterDataCodeResolverService } from './master-data-code-resolver.service';
import { UnmappedEventService } from '../unmapped-event/unmapped-event.service';
import {
  fetchEventFrameAttributes,
  mapAttributesToFields,
  parseTenantMappingRules,
  resolveEventType,
  NO_TEMPLATE_KEY,
} from './pi-event-mapper';

export interface PullEventsRequest {
  tenantId: string;
  startTimeUtc?: string;
  endTimeUtc?: string;
  scopeType?: 'database' | 'element';
  scopeId?: string;
  templateName?: string;
  maxCount?: number;
  autoCreateProductionEvents?: boolean;
}

export interface PullEventsResponse {
  success: boolean;
  eventsFetched: number;
  eventsStored: number;
  productionEventsCreated: number;
  productionEventsUpdated: number;
  productionEventsSkipped: number;
  unmappedEventsCreated: number;
  errors: string[];
  events: any[];
}

@Injectable()
export class PIEventPullService {
  private readonly logger = new Logger(PIEventPullService.name);

  constructor(
    @InjectRepository(PIConnection)
    private readonly piConnectionRepository: Repository<PIConnection>,
    @InjectRepository(PIEvent)
    private readonly piEventRepository: Repository<PIEvent>,
    @InjectRepository(PIMapping)
    private readonly piMappingRepository: Repository<PIMapping>,
    @InjectRepository(AfBinding)
    private readonly afBindingRepository: Repository<AfBinding>,
    @InjectRepository(PISyncWatermark)
    private readonly piSyncWatermarkRepository: Repository<PISyncWatermark>,
    @InjectRepository(ProductionEvent)
    private readonly productionEventRepository: Repository<ProductionEvent>,
    @InjectRepository(ProductionPlan)
    private readonly productionPlanRepository: Repository<ProductionPlan>,
    private readonly productionEventService: ProductionEventService,
    private readonly hierarchyMappingService: HierarchyMappingService,
    private readonly piWebApiService: PIWebApiService,
    private readonly codeResolver: MasterDataCodeResolverService,
    private readonly unmappedEventService: UnmappedEventService,
  ) {}

  async pullEvents(request: PullEventsRequest): Promise<PullEventsResponse> {
    const errors: string[] = [];
    let eventsFetched = 0;
    let eventsStored = 0;
    let productionEventsCreated = 0;
    let productionEventsUpdated = 0;
    let productionEventsSkipped = 0;
    let unmappedEventsCreated = 0;

    try {
      const connection = await this.piWebApiService.getActiveConnection(request.tenantId);
      const { scopeType, scopeId } = this.piWebApiService.resolveScope(
        connection,
        request.scopeType,
        request.scopeId,
      );

      const endTime = request.endTimeUtc || new Date().toISOString();
      const startTime =
        request.startTimeUtc || new Date(Date.now() - 3600 * 1000).toISOString();
      const maxCount = request.maxCount || 200;

      const data = await this.piWebApiService.getEventFrames(request.tenantId, {
        scopeType,
        scopeId,
        startTimeUtc: startTime,
        endTimeUtc: endTime,
        templateName: request.templateName,
        maxCount,
      });

      const eventFrames = data?.Items || [];
      eventsFetched = eventFrames.length;
      this.logger.log(`Fetched ${eventsFetched} event frames from PI for tenant ${request.tenantId}`);

      const mappingConfig = await this.loadTenantMappingConfig(request.tenantId);
      const bindings = await this.afBindingRepository.find({ where: { tenantId: request.tenantId } });
      const bindingMap = new Map(
        bindings.filter((b) => b.webId).map((b) => [b.webId!, b]),
      );

      const storedEvents: any[] = [];
      const requestFn = (path: string) => this.piWebApiService.request(request.tenantId, path);

      for (const ef of eventFrames) {
        try {
          const attributes = await fetchEventFrameAttributes(requestFn, ef.WebId);
          const existingPiEvent = await this.piEventRepository.findOne({
            where: { webId: ef.WebId, tenantId: request.tenantId },
          });

          const eventData: Partial<PIEvent> = {
            webId: ef.WebId,
            tenantId: request.tenantId,
            organizationId: connection.organizationId,
            template: ef.TemplateName || null,
            name: ef.Name,
            startUtc: ef.StartTime ? new Date(ef.StartTime) : undefined,
            endUtc: ef.EndTime ? new Date(ef.EndTime) : undefined,
            primaryAfId: ef.PrimaryReferencedElement?.WebId || null,
            eventData: JSON.stringify({ ...ef, Attributes: attributes }),
          };

          if (existingPiEvent) {
            Object.assign(existingPiEvent, eventData);
            storedEvents.push(await this.piEventRepository.save(existingPiEvent));
          } else {
            storedEvents.push(await this.piEventRepository.save(this.piEventRepository.create(eventData)));
          }
          eventsStored++;

          if (request.autoCreateProductionEvents !== false) {
            const result = await this.createProductionEventFromPI(
              ef,
              attributes,
              request.tenantId,
              connection.organizationId,
              mappingConfig,
              bindingMap,
            );

            if (result === 'created') productionEventsCreated++;
            else if (result === 'updated') productionEventsUpdated++;
            else if (result === 'unmapped') unmappedEventsCreated++;
            else productionEventsSkipped++;
          }
        } catch (error: any) {
          errors.push(`Failed to process event ${ef.WebId}: ${error.message}`);
          this.logger.warn(`Failed to process PI event ${ef.WebId}: ${error.message}`);
        }
      }

      connection.lastSyncTime = new Date();
      await this.piConnectionRepository.save(connection);
      await this.upsertWatermark(request.tenantId, scopeType, scopeId, endTime);

      return {
        success: errors.length === 0,
        eventsFetched,
        eventsStored,
        productionEventsCreated,
        productionEventsUpdated,
        productionEventsSkipped,
        unmappedEventsCreated,
        errors,
        events: storedEvents,
      };
    } catch (error: any) {
      this.logger.error(`Error pulling events from PI: ${error.message}`, error.stack);
      errors.push(error.message);
      return {
        success: false,
        eventsFetched,
        eventsStored,
        productionEventsCreated,
        productionEventsUpdated,
        productionEventsSkipped,
        unmappedEventsCreated,
        errors,
        events: [],
      };
    }
  }

  async testConnection(tenantId: string): Promise<{ connected: boolean; message: string }> {
    return this.piWebApiService.testConnection(tenantId);
  }

  private async loadTenantMappingConfig(tenantId: string) {
    const mappings = await this.piMappingRepository.find({
      where: { tenantId, isActive: true },
    });
    const primary = mappings[0];
    return parseTenantMappingRules(primary?.mappingRules);
  }

  private async upsertWatermark(
    tenantId: string,
    scopeType: 'database' | 'element',
    scopeId: string,
    lastEndUtc: string,
  ) {
    const existing = await this.piSyncWatermarkRepository.findOne({
      where: { tenantId, syncType: scopeType, lastSyncMarker: scopeId },
    });

    const payload: Partial<PISyncWatermark> = {
      tenantId,
      syncType: scopeType,
      lastSyncMarker: scopeId,
      lastSyncTimestamp: new Date(lastEndUtc),
      syncStatus: 'success',
    };

    if (existing) {
      Object.assign(existing, payload);
      await this.piSyncWatermarkRepository.save(existing);
    } else {
      await this.piSyncWatermarkRepository.save(this.piSyncWatermarkRepository.create(payload));
    }
  }

  private async findPlanForEvent(
    unitId: string,
    timestamp: string,
    tenantId?: string,
  ): Promise<ProductionPlan | null> {
    const where: any = { unitId };
    if (tenantId) where.tenantId = tenantId;
    const plans = await this.productionPlanRepository.find({ where });
    const eventTime = new Date(timestamp).getTime();
    return (
      plans.find((plan) => {
        const start = new Date(plan.startDate).getTime();
        const end = new Date(plan.endDate).getTime();
        return eventTime >= start && eventTime <= end;
      }) || null
    );
  }

  private async createProductionEventFromPI(
    ef: any,
    attributes: Record<string, any>,
    tenantId: string,
    organizationId: string | undefined,
    mappingConfig: ReturnType<typeof parseTenantMappingRules>,
    bindingMap: Map<string, AfBinding>,
  ): Promise<'created' | 'updated' | 'skipped' | 'unmapped'> {
    const templateName = ef.TemplateName || NO_TEMPLATE_KEY;
    const eventType = resolveEventType(templateName, mappingConfig);
    const attrMap = mappingConfig.attributesByTemplate[templateName] ||
      mappingConfig.attributesByTemplate[NO_TEMPLATE_KEY] ||
      {};
    let mappedFields = mapAttributesToFields(templateName, attributes, attrMap);
    mappedFields = await this.codeResolver.resolveMappedCodeFields(mappedFields, tenantId);

    const primaryWebId = ef.PrimaryReferencedElement?.WebId;
    const primaryPath = ef.PrimaryReferencedElement?.Path;

    let hierarchyIds = await this.hierarchyMappingService.findHierarchyMapping({
      sourceType: 'PI',
      sourceIdentifier: primaryWebId || ef.WebId,
      sourcePath: primaryPath || ef.Path,
      tenantId,
    });

    if (!hierarchyIds) {
      const binding = primaryWebId ? bindingMap.get(primaryWebId) : undefined;
      if (binding) {
        hierarchyIds = {
          tenantId: binding.tenantId || tenantId,
          organizationId: binding.organizationId || organizationId,
          unitId: binding.boundType === 'unit' ? binding.localId : undefined,
          assetId: binding.boundType === 'asset' ? binding.localId : undefined,
        };
      }
    }

    const unitId = hierarchyIds?.unitId;
    if (!unitId) {
      await this.recordUnmappedPIEvent({
        ef,
        attributes,
        mappedFields,
        templateName,
        eventType,
        tenantId,
        organizationId,
        primaryWebId,
        primaryPath,
        reason: 'No unit/asset binding or hierarchy mapping found for PI element',
        suggestions: [
          'Bind the PI AF element to a unit in Connectivity → AVEVA PI → AF Hierarchy',
          'Or create a hierarchy mapping in Connectivity → Hierarchy Mapping',
          'Verify PrimaryReferencedElement on the PI event frame matches a bound AF node',
        ],
      });
      return 'unmapped';
    }

    const startTimeDate = new Date(ef.StartTime);
    const endTimeDate = ef.EndTime ? new Date(ef.EndTime) : undefined;

    let planId: string | undefined;
    if (eventType === 'ProductionLoss' || eventType === 'ProductionOutput') {
      const plan = await this.findPlanForEvent(unitId, startTimeDate.toISOString(), tenantId);
      planId = plan?.id;
    }

    const productionEventDto: any = {
      tenantId: hierarchyIds?.tenantId || tenantId,
      organizationId: hierarchyIds?.organizationId || organizationId,
      eventId: ef.WebId,
      eventType,
      description: mappedFields.description || ef.Name || 'Event from PI',
      startTime: startTimeDate.toISOString(),
      endTime: endTimeDate ? endTimeDate.toISOString() : undefined,
      status: 'Open',
      source: 'PI',
      unitId,
      assetId: hierarchyIds?.assetId,
      planId,
      ...mappedFields,
    };

    const existing = await this.productionEventRepository.findOne({
      where: { eventId: ef.WebId, tenantId: productionEventDto.tenantId },
    });

    if (existing) {
      await this.productionEventService.update(existing.id, productionEventDto);
      return 'updated';
    }

    await this.productionEventService.create(productionEventDto);
    return 'created';
  }

  private async recordUnmappedPIEvent(params: {
    ef: any;
    attributes: Record<string, any>;
    mappedFields: Record<string, any>;
    templateName: string;
    eventType: string;
    tenantId: string;
    organizationId?: string;
    primaryWebId?: string;
    primaryPath?: string;
    reason: string;
    suggestions: string[];
  }): Promise<void> {
    const {
      ef,
      attributes,
      mappedFields,
      templateName,
      eventType,
      tenantId,
      organizationId,
      primaryWebId,
      primaryPath,
      reason,
      suggestions,
    } = params;

    const eventSnapshot = {
      eventId: ef.WebId,
      id: ef.WebId,
      name: ef.Name,
      template: templateName,
      eventType,
      startTime: ef.StartTime,
      endTime: ef.EndTime,
      primaryAfId: primaryWebId,
      primaryAfPath: primaryPath,
      source: 'PI',
      attributes,
      mappedFields,
    };

    await this.unmappedEventService.upsertBySource({
      tenantId,
      organizationId,
      eventName: ef.Name,
      eventType,
      startTime: ef.StartTime,
      endTime: ef.EndTime || undefined,
      sourceSystem: 'PI',
      sourceId: ef.WebId,
      eventData: JSON.stringify({
        reason,
        suggestions,
        event: eventSnapshot,
        piWebId: ef.WebId,
        template: templateName,
        primaryAfId: primaryWebId,
        primaryAfPath: primaryPath,
      }),
    });

    this.logger.log(`Recorded unmapped PI event ${ef.WebId} for tenant ${tenantId}: ${reason}`);
  }
}
