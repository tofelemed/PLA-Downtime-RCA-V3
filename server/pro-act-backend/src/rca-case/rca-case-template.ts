import { EntityManager } from 'typeorm';
import { RcaLogicNode } from './rca-case-json';
import { parseArray, parseObject, Raw, text } from './rca-json-read';

/** The logic tree of a case is limited to 500 nodes (same bound as the case body). */
const MAX_NODES = 500;

/**
 * Flattens a template tree (`template_data.nodes`, nested `children`) into case logic nodes with fresh
 * ids (`t1`, `t2`, …) so a reset never collides with ids of evidence links made against older nodes.
 */
export function flattenTemplateTree(roots: Raw[]): RcaLogicNode[] {
  const out: RcaLogicNode[] = [];
  const walk = (nodes: Raw[], parentId: string | null) => {
    for (const node of nodes) {
      if (out.length >= MAX_NODES) return;
      const id = `t${out.length + 1}`;
      out.push({
        id,
        parentId,
        label: text(node.name) ?? text(node.label) ?? '',
        kind: text(node.category),
        status: 'open',
        notes: text(node.note),
        code: text(node.code),
        description: text(node.description),
        verified: null,
      });
      walk(parseArray(node.children), id);
    }
  };
  walk(roots, null);
  return out;
}

/** The template's tree as case nodes ([] when the template has none); the template is of the tenant. */
export async function templateLogicTree(
  manager: EntityManager,
  tenantId: string,
  templateId: string,
): Promise<RcaLogicNode[]> {
  const rows: Array<{ template_data: string | null }> = await manager.query(
    `SELECT "template_data" FROM "rca_templates" WHERE "id" = $1 AND "tenant_id" = $2`,
    [templateId, tenantId],
  );
  const data = parseObject(rows[0]?.template_data ?? null);
  return data ? flattenTemplateTree(parseArray(data.nodes)) : [];
}
