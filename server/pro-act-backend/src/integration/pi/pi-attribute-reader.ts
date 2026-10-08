import { assertAnswer, getMany } from './pi-batch';
import { PiHttpClient } from './pi-http-client';

export interface AttributeRead {
  /** attribute values by frame WebId, then by attribute name */
  values: Map<string, Record<string, unknown>>;
  batchUnsupported: boolean;
}

interface StreamValueItem {
  Name?: unknown;
  Value?: { Value?: unknown } | null;
}

/**
 * Attribute values of many event frames with one `streamsets/{webId}/value` request each, sent as one
 * or two batch calls per page (PI02, I13); per frame only when the batch controller is missing. A value
 * is kept as delivered (digital states stay `{ Name, Value, IsSystem }`); an attribute PI does not
 * return is absent, so the typed mapping yields null, never NaN. A failed answer fails the page.
 */
export async function readAttributes(
  client: PiHttpClient,
  webIds: string[],
  useBatch: boolean,
): Promise<AttributeRead> {
  const paths = webIds.map(
    (webId) =>
      `streamsets/${encodeURIComponent(webId)}/value?selectedFields=Items.Name;Items.Value.Value`,
  );
  const many = await getMany(client, paths, useBatch);
  const values = new Map<string, Record<string, unknown>>();
  many.answers.forEach((answer, index) => {
    assertAnswer(answer, `attributes of event frame ${webIds[index]}`);
    values.set(webIds[index], attributeValues(answer.content));
  });
  return { values, batchUnsupported: many.batchUnsupported };
}

function attributeValues(content: unknown): Record<string, unknown> {
  const items = (content as { Items?: unknown } | null)?.Items;
  const attributes: Record<string, unknown> = {};
  if (!Array.isArray(items)) return attributes;
  for (const item of items as StreamValueItem[]) {
    if (typeof item.Name !== 'string') continue;
    attributes[item.Name] = item.Value?.Value ?? null;
  }
  return attributes;
}
