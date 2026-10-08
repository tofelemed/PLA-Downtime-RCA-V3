import type { PIEventRecord } from './PIStore';
import eventFieldCatalog from '../../../contracts/event-field-catalog.json';

export type AppEventType = 'ProductionLoss'|'IOW'|'SOL'|'APM'|'FailureWO'|'ProductionOutput';

/**
 * Defaults come from the shared event field catalog (plan 1.3, ING04): the same file the backend validates
 * attribute mappings against, so UI defaults and backend fields cannot drift (I10).
 */
export const NO_TEMPLATE_KEY = eventFieldCatalog.noTemplateKey;

/** Every event field a PI attribute may be mapped to. */
export const mappableEventFields: string[] = eventFieldCatalog.fields.map((field) => field.name);

export const defaultTemplateToEventType: Record<string, AppEventType> = Object.fromEntries(
  eventFieldCatalog.templates
    .filter((template) => template.name !== NO_TEMPLATE_KEY)
    .map((template) => [template.name, template.eventType as AppEventType]),
);

export const defaultAttributesByTemplate: Record<string, Record<string, string>> = Object.fromEntries(
  eventFieldCatalog.templates.map((template) => [
    template.name,
    Object.fromEntries(template.defaultRules.map((rule) => [rule.sourceAttr, rule.targetField])),
  ]),
);

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

