import type { PIEventRecord } from './PIStore';

export type AppEventType = 'ProductionLoss'|'IOW'|'SOL'|'APM'|'FailureWO'|'ProductionOutput';

export const NO_TEMPLATE_KEY = '*NoTemplate*';

export const defaultTemplateToEventType: Record<string, AppEventType> = {
  'Production Loss': 'ProductionLoss',
  'IOW Deviation': 'IOW',
  'SOL Violation': 'SOL',
  'APM Alert': 'APM',
  'Failure WO': 'FailureWO',
  'Production Output': 'ProductionOutput',
};

export const defaultAttributesByTemplate: Record<string, Record<string, string>> = {
  'Production Loss': {
    Description: 'description',
    ReasonCode: 'reasonCode',
    OEECode: 'oeeCode',
    ImpactCode: 'impactCode',
    Quantity: 'quantity',
    Cost: 'cost',
    Shift: 'shift',
    Crew: 'crew',
  },
  'IOW Deviation': {
    Parameter: 'parameter',
    Limit: 'limit',
    LimitType: 'limitType',
    RecommendedAction: 'recommendedAction',
  },
  'SOL Violation': {
    SolType: 'solType',
    Description: 'description',
  },
  'APM Alert': {
    FailureMode: 'failureMode',
    RecommendedAction: 'recommendedAction',
    HealthIndex: 'healthIndex',
  },
  'Failure WO': {
    WorkOrderId: 'workOrderId',
    FailureMode: 'failureMode',
  },
  'Production Output': {
    GoodQty: 'goodQty',
    ScrapQty: 'scrapQty',
  },
  [NO_TEMPLATE_KEY]: {
    // Fallback keys commonly seen in untitled EFs
    Description: 'description',
    Quantity: 'quantity',
    Cost: 'cost',
  },
};

export function projectEFToAppEvent(ef: any, attrMap: Record<string, string>) {
  const out: Record<string, any> = {
    name: ef.Name,
    startUtc: ef.StartTime,
    endUtc: ef.EndTime,
    template: ef.TemplateName,
    efId: ef.WebId,
  };
  if (ef.PrimaryReferencedElement) {
    out.primaryAfId = ef.PrimaryReferencedElement.WebId;
  }
  // Attributes collection may come separately; map if present on EF response
  if (ef.HasAttributes && ef.Attributes) {
    ef.Attributes.Items?.forEach((a: any) => {
      const key = attrMap[a.Name];
      if (key) out[key] = a.Value?.Value ?? a.Value;
    });
  }
  return out;
}

export function toPIEventRecord(ef: any, attributes: Record<string, any>): PIEventRecord {
  return {
    id: ef.WebId,
    efId: ef.WebId,
    name: ef.Name,
    template: ef.TemplateName,
    startUtc: ef.StartTime,
    endUtc: ef.EndTime,
    primaryAfId: ef.PrimaryReferencedElement?.WebId,
    attributes,
    lastModifiedUtc: ef.LastModified,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

