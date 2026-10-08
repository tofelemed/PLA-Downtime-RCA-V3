import { legacyRules } from '../attribute-mapping/attribute-rules';
import {
  EVENT_FIELD_CATALOG,
  NO_TEMPLATE_KEY,
} from '../attribute-mapping/event-field-catalog';
import { FieldRule } from '../attribute-mapping/field-rule';

export { NO_TEMPLATE_KEY };

/** PI template → legacy event type, from the field catalog. */
export const DEFAULT_TEMPLATE_TO_EVENT_TYPE: Readonly<Record<string, string>> =
  Object.fromEntries(
    EVENT_FIELD_CATALOG.templates.map((template) => [
      template.name,
      template.eventType,
    ]),
  );

/**
 * The tenant's legacy `pi_mappings.mapping_rules` JSON: template → event type overrides and per-template
 * attribute overrides as typed rules. The rules are merged field by field over the catalog defaults
 * (plan 1.3, I10); they no longer replace a template's whole map.
 */
export interface TenantMappingConfig {
  templateToEventType: Record<string, string>;
  rulesByTemplate: Record<string, FieldRule[]>;
}

export function parseTenantMappingRules(
  mappingRules?: string | null,
): TenantMappingConfig {
  const parsed = parseJsonObject(mappingRules);
  const rulesByTemplate: Record<string, FieldRule[]> = {};
  const attributes = asRecord(parsed.attributesByTemplate);
  for (const [template, map] of Object.entries(attributes)) {
    rulesByTemplate[template] = legacyRules(asRecord(map));
  }
  const overrides = Object.entries(asRecord(parsed.templateToEventType)).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return {
    templateToEventType: {
      ...DEFAULT_TEMPLATE_TO_EVENT_TYPE,
      ...Object.fromEntries(overrides),
    },
    rulesByTemplate,
  };
}

export function resolveEventType(
  templateName: string,
  mapping: TenantMappingConfig,
): string {
  const key = templateName || NO_TEMPLATE_KEY;
  return (
    mapping.templateToEventType[key] ||
    mapping.templateToEventType[NO_TEMPLATE_KEY] ||
    'ProductionLoss'
  );
}

interface PiAttributeItem {
  Name?: unknown;
  WebId?: unknown;
  Value?: unknown;
  DefaultValue?: unknown;
  Links?: { Value?: unknown };
}

/**
 * Attribute values of an event frame by name. Values are returned as delivered (digital states keep
 * their `{ Name, Value, IsSystem }` object); the typed mapping converts them.
 */
export async function fetchEventFrameAttributes(
  requestFn: (path: string) => Promise<unknown>,
  webId: string,
): Promise<Record<string, unknown>> {
  const attributes: Record<string, unknown> = {};
  try {
    const listing = asRecord(
      await requestFn(`/eventframes/${encodeURIComponent(webId)}/attributes`),
    );
    const items = Array.isArray(listing.Items)
      ? (listing.Items as PiAttributeItem[])
      : [];
    for (const item of items) {
      if (typeof item.Name !== 'string') continue;
      attributes[item.Name] = await attributeValue(requestFn, item);
    }
  } catch {
    // an attribute listing failure leaves the frame without attributes (mapping reports what is missing)
  }
  return attributes;
}

async function attributeValue(
  requestFn: (path: string) => Promise<unknown>,
  item: PiAttributeItem,
): Promise<unknown> {
  const inline = item.Value ?? item.DefaultValue ?? null;
  const link = item.Links?.Value;
  if (inline !== null || typeof link !== 'string') return inline;
  try {
    const path =
      link.replace(/^.*\/piwebapi/i, '') ||
      `/attributes/${encodeURIComponent(String(item.WebId))}/value`;
    const response = await requestFn(path);
    const record = asRecord(response);
    return 'Value' in record ? record.Value : response;
  } catch {
    return null;
  }
}

function parseJsonObject(text?: string | null): Record<string, unknown> {
  if (!text) return {};
  try {
    return asRecord(JSON.parse(text));
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
