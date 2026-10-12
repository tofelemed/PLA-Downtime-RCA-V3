import { Repository } from 'typeorm';
import { codeCycle, invalidReference } from '../code-library/code-references';
import { RCACauseCode } from './rca-cause-code.entity';

export interface CauseNode {
  /** Absent on create (a new cause cannot be anyone's ancestor). */
  id?: string;
  tenantId: string | null;
}

/**
 * Parent rules of the RCA cause library tree: the parent is an existing cause of the same tenant
 * (422 INVALID_REFERENCE) and never the cause itself or one of its descendants (422 CODE_CYCLE).
 */
export async function assertValidCauseParent(
  repository: Repository<RCACauseCode>,
  node: CauseNode,
  parentId: string,
): Promise<void> {
  const parent = await repository.findOneBy({ id: parentId });
  if (!parent || (parent.tenantId ?? null) !== node.tenantId) {
    throw invalidReference(
      'parentId',
      'parentId must be an RCA cause code of the same tenant',
    );
  }
  if (node.id && (await isAncestorOrSelf(repository, node.id, parentId))) {
    throw codeCycle();
  }
}

/** True when `nodeId` is `startId` or one of its ancestors (`UNION` stops on a corrupt loop). */
async function isAncestorOrSelf(
  repository: Repository<RCACauseCode>,
  nodeId: string,
  startId: string,
): Promise<boolean> {
  const rows = await repository.query<unknown[]>(
    `WITH RECURSIVE ancestors AS (
       SELECT id, parent_id FROM rca_cause_codes WHERE id = $1
       UNION
       SELECT c.id, c.parent_id FROM rca_cause_codes c JOIN ancestors a ON c.id = a.parent_id
     )
     SELECT 1 FROM ancestors WHERE id = $2 LIMIT 1`,
    [startId, nodeId],
  );
  return rows.length > 0;
}
