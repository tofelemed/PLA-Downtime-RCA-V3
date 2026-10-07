export type AppEventType =
  | 'ProductionLoss'
  | 'IOW'
  | 'SOL'
  | 'APM'
  | 'FailureWO'
  | 'ProductionOutput';

export const NO_TEMPLATE_KEY = '*NoTemplate*';

export const DEFAULT_TEMPLATE_TO_EVENT_TYPE: Record<string, AppEventType> = {
  'Production Loss': 'ProductionLoss',
  'IOW Deviation': 'IOW',
  'SOL Violation': 'SOL',
  'APM Alert': 'APM',
  'Failure WO': 'FailureWO',
  'Production Output': 'ProductionOutput',
  [NO_TEMPLATE_KEY]: 'ProductionLoss',
};

export const DEFAULT_ATTRIBUTES_BY_TEMPLATE: Record<string, Record<string, string>> = {
  'Production Loss': {
    Description: 'description',
    ReasonCode: 'reasonCodeId',
    OEECode: 'oeeCodeId',
    ImpactCode: 'impactCodeId',
    Quantity: 'quantity',
    Cost: 'cost',
    Shift: 'shift',
    Crew: 'crew',
    Duration: 'duration',
    LossCategory: 'lossCategory',
    OperatorName: 'operatorName',
  },
  'IOW Deviation': {
    Parameter: 'parameter',
    Value: 'value',
    Limit: 'limit',
    LimitType: 'limitType',
    BreachDuration: 'breachDuration',
    RecommendedAction: 'recommendedAction',
    Description: 'description',
    Severity: 'severity',
  },
  'SOL Violation': {
    SolType: 'solType',
    Description: 'description',
    Severity: 'severity',
  },
  'APM Alert': {
    FailureMode: 'failureMode',
    RecommendedAction: 'recommendedAction',
    APMType: 'apmType',
    Severity: 'severity',
    Description: 'description',
  },
  'Failure WO': {
    WorkOrderId: 'workOrderId',
    FailureMode: 'failureMode',
    Description: 'description',
  },
  'Production Output': {
    GoodQty: 'quantity',
    ScrapQty: 'defectiveQuantity',
    Description: 'description',
    Quantity: 'quantity',
  },
  [NO_TEMPLATE_KEY]: {
    Description: 'description',
    Quantity: 'quantity',
    Cost: 'cost',
  },
};

export interface TenantMappingConfig {
  templateToEventType: Record<string, AppEventType | string>;
  attributesByTemplate: Record<string, Record<string, string>>;
}

export function parseTenantMappingRules(mappingRules?: string | null): TenantMappingConfig {
  if (!mappingRules) {
    return {
      templateToEventType: { ...DEFAULT_TEMPLATE_TO_EVENT_TYPE },
      attributesByTemplate: { ...DEFAULT_ATTRIBUTES_BY_TEMPLATE },
    };
  }

  try {
    const parsed = JSON.parse(mappingRules);
    return {
      templateToEventType: {
        ...DEFAULT_TEMPLATE_TO_EVENT_TYPE,
        ...(parsed.templateToEventType || {}),
      },
      attributesByTemplate: {
        ...DEFAULT_ATTRIBUTES_BY_TEMPLATE,
        ...(parsed.attributesByTemplate || {}),
      },
    };
  } catch {
    return {
      templateToEventType: { ...DEFAULT_TEMPLATE_TO_EVENT_TYPE },
      attributesByTemplate: { ...DEFAULT_ATTRIBUTES_BY_TEMPLATE },
    };
  }
}

export async function fetchEventFrameAttributes(
  requestFn: (path: string) => Promise<any>,
  webId: string,
): Promise<Record<string, any>> {
  const attributes: Record<string, any> = {};
  try {
    const attrRes = await requestFn(`/eventframes/${encodeURIComponent(webId)}/attributes`);
    const attrItems: any[] = attrRes?.Items ?? [];
    for (const attr of attrItems) {
      let value = attr?.Value?.Value ?? attr?.Value ?? attr?.DefaultValue ?? null;
      if (value === null && attr?.Links?.Value) {
        try {
          const valueRes = await requestFn(
            attr.Links.Value.replace(/^.*\/piwebapi/i, '').replace(/^\/piwebapi/i, '') ||
              `/attributes/${encodeURIComponent(attr.WebId)}/value`,
          );
          value = valueRes?.Value ?? valueRes;
        } catch {
          // ignore individual attribute value errors
        }
      }
      attributes[attr.Name] = value;
    }
  } catch {
    // ignore attribute fetch errors
  }
  return attributes;
}

export function mapAttributesToFields(
  templateName: string,
  attributes: Record<string, any>,
  attrMap: Record<string, string>,
): Record<string, any> {
  const mapped: Record<string, any> = {};
  for (const [efAttr, appField] of Object.entries(attrMap)) {
    const val = attributes[efAttr];
    if (val === undefined || val === null) continue;

    if (['quantity', 'cost', 'value', 'limit', 'breachDuration', 'defectiveQuantity', 'duration'].includes(appField)) {
      mapped[appField] = Number(val);
    } else {
      mapped[appField] = val;
    }
  }

  if (!mapped.description && attributes.Description) {
    mapped.description = attributes.Description;
  }

  return mapped;
}

export function resolveEventType(templateName: string, mapping: TenantMappingConfig): string {
  const key = templateName || NO_TEMPLATE_KEY;
  return mapping.templateToEventType[key] || mapping.templateToEventType[NO_TEMPLATE_KEY] || 'ProductionLoss';
}
