import { PIClient } from './PIClient';
import { piStore, PIEventRecord, PIMappings } from './PIStore';
import { masterDataService, ProductionEvent } from '@/services/MasterDataService';

export interface SyncParams {
  tenantId: string;
  scopeType: 'element'|'database';
  scopeId: string; // element or database WebId
  startTimeUtc: string;
  endTimeUtc: string;
  maxCount?: number;
}

export class PISyncService {
  private client: PIClient;

  constructor(client: PIClient) {
    this.client = client;
  }

  async syncRange(params: SyncParams) {
    const { tenantId, scopeType, scopeId, startTimeUtc, endTimeUtc, maxCount = 200 } = params;
    const mappings = (await piStore.getMappings(tenantId)) as PIMappings | null;
    const allBindings = await piStore.listBindings(tenantId);
    const webIdToBinding: Record<string, { boundType: 'unit'|'asset'|'tenant'; localId: string }> = {};
    for (const b of allBindings) webIdToBinding[b.webId] = { boundType: b.boundType, localId: b.localId };

    // Fetch EF list for the scope; for MVP, no paging beyond maxCount
    const res = await this.client.getEventFrames({ elementWebId: scopeType === 'element' ? scopeId : undefined, databaseWebId: scopeType === 'database' ? scopeId : undefined, startTimeUtc, endTimeUtc, maxCount });
    const items: any[] = res?.Items ?? [];

    const toPersistPI: PIEventRecord[] = [];
    const toCreateAppEvents: Array<Omit<ProductionEvent, 'id' | 'createdAt' | 'updatedAt'>> = [];

    for (const ef of items) {
      // Attributes for mapping (optional if heavy)
      let attributes: Record<string, any> = {};
      try {
        const attrRes = await this.client.getEventFrameAttributes(ef.WebId);
        const attrItems: any[] = attrRes?.Items ?? [];
        for (const a of attrItems) {
          // Value may be nested under Value, or require querying /value; best-effort take .Value
          attributes[a.Name] = a.Value ?? a.DefaultValue ?? null;
        }
      } catch {
        // ignore attribute errors in MVP
      }

      const piRecord: PIEventRecord = {
        id: ef.WebId,
        efId: ef.WebId,
        template: ef.TemplateName,
        name: ef.Name,
        startUtc: ef.StartTime,
        endUtc: ef.EndTime,
        primaryAfId: ef.PrimaryReferencedElement?.WebId,
        attributes,
        lastModifiedUtc: ef.LastModified ?? undefined,
        tenantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any;
      toPersistPI.push(piRecord);

      // Projection to app ProductionEvent
      const tplKey = ef.TemplateName || '*NoTemplate*';
      const eventType = mappings?.templateToEventType?.[tplKey] ?? 'ProductionLoss';

      // Determine unit/asset from bindings
      const primaryAfId: string | undefined = piRecord.primaryAfId || (scopeType === 'element' ? scopeId : undefined);
      const bound = primaryAfId ? webIdToBinding[primaryAfId] : undefined;
      const unitId = bound?.boundType === 'unit' ? bound.localId : undefined;
      const assetId = bound?.boundType === 'asset' ? bound.localId : undefined;

      // Map attributes using mapping table (optional)
      const attrMap = mappings?.attributesByTemplate?.[tplKey] || {};
      const mappedFields: any = {};
      for (const [efAttr, appField] of Object.entries(attrMap)) {
        const val = attributes[efAttr];
        if (val !== undefined) mappedFields[appField] = val;
      }

      // Find plan for ProductionLoss/Output if possible
      let planId: string | undefined = undefined;
      if ((eventType === 'ProductionLoss' || eventType === 'ProductionOutput') && unitId) {
        const plan = await masterDataService.findPlanForEvent(unitId, piRecord.startUtc, tenantId);
        planId = plan?.id;
      }

      const appEvent: Omit<ProductionEvent, 'id' | 'createdAt' | 'updatedAt'> = {
        eventId: ef.WebId,
        planId,
        unitId: unitId || '',
        assetId,
        impactCodeId: mappedFields.impactCodeId,
        oeeCodeId: mappedFields.oeeCodeId,
        description: mappedFields.description || ef.Name || `${ef.TemplateName} from PI`,
        startTime: piRecord.startUtc,
        endTime: piRecord.endUtc,
        source: 'PI',
        quantity: mappedFields.quantity ? Number(mappedFields.quantity) : undefined,
        cost: mappedFields.cost ? Number(mappedFields.cost) : undefined,
        status: 'Open',
        rcaId: undefined,
        eventType: eventType as any,
        parameter: mappedFields.parameter,
        value: mappedFields.value ? Number(mappedFields.value) : undefined,
        limit: mappedFields.limit ? Number(mappedFields.limit) : undefined,
        limitType: mappedFields.limitType,
        breachDuration: mappedFields.breachDuration ? Number(mappedFields.breachDuration) : undefined,
        solType: mappedFields.solType,
        apmType: mappedFields.apmType,
        severity: mappedFields.severity,
        recommendedAction: mappedFields.recommendedAction,
        workOrderId: mappedFields.workOrderId,
        failureMode: mappedFields.failureMode,
        defectiveQuantity: mappedFields.defectiveQuantity ? Number(mappedFields.defectiveQuantity) : undefined,
        shift: mappedFields.shift,
        crew: mappedFields.crew,
        lossCategory: mappedFields.lossCategory,
        operatorName: mappedFields.operatorName,
        reasonCodeId: mappedFields.reasonCodeId,
        duration: mappedFields.duration ? Number(mappedFields.duration) : undefined,
        tenantId,
      } as any;
      // Skip creation if no unitId bound
      if (appEvent.unitId) {
        toCreateAppEvents.push(appEvent);
      }
    }

    // Persist PI records and app events
    await piStore.upsertEvents(toPersistPI);
    for (const ev of toCreateAppEvents) {
      // Avoid duplicates: check if an event with same eventId exists
      const existing = (await masterDataService.getProductionEvents({ tenantId: ev.tenantId as string })).find(e => e.eventId === ev.eventId);
      if (!existing) {
        await masterDataService.createProductionEvent(ev);
      }
    }

    // Update watermark
    await piStore.setWatermark({ tenantId, scopeType, scopeId, lastEndUtc: endTimeUtc });

    return { fetched: items.length, stored: toPersistPI.length, createdAppEvents: toCreateAppEvents.length };
  }
}

