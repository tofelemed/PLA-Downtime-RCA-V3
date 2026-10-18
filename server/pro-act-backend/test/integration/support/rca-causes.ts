import { randomUUID } from 'crypto';
import * as request from 'supertest';

/** What the cause helpers need of a test world (RcaWorld, KnowledgeWorld). */
export interface CauseWorld {
  rows<T>(sql: string, params?: unknown[]): Promise<T[]>;
  post(path: string, body: object): request.Test;
}

/** A cause of the tenant's cause catalogue (`active` false = retired). */
export async function catalogueCause(
  world: CauseWorld,
  tenantId: string,
  active = true,
): Promise<string> {
  const id = randomUUID();
  await world.rows(
    `INSERT INTO rca_cause_codes (id, code, name, tenant_id, is_active) VALUES ($1, $2, 'Coupling misalignment', $3, $4)`,
    [id, `RC-${id.slice(0, 8)}`, tenantId, active],
  );
  return id;
}

/** Item 7: the coded root cause a case opened since typed causes needs before closure is requested. */
export async function addCodedRootCause(
  world: CauseWorld,
  tenantId: string,
  caseId: string,
): Promise<string> {
  const causeCodeId = await catalogueCause(world, tenantId);
  await world
    .post(`rcas/${caseId}/causes`, {
      kind: 'root',
      causeCodeId,
      statement: 'Coupling misaligned after seal change',
    })
    .expect(201);
  return causeCodeId;
}
