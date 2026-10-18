import { expect } from '@playwright/test';
import { call, command } from './admin-helpers';

/**
 * The RCA case workflow through the v2 API for e2e journeys (RCA-01 / SME CA1): the status never changes
 * by PATCH; moves are `POST /v2/rcas/{id}/transitions` with If-Match; closure needs finished, evidenced
 * actions, a verified effectiveness, residual risk and an approver independent of the investigation.
 */
interface CaseRow {
  status: string;
  rowVersion: number;
  rootCause: string | null;
  logicTree: unknown[];
}

interface ActionRow {
  id: string;
  status: string;
  rowVersion: number;
  verificationStatus: string;
  baseline: unknown;
}

const caseOf = async (token: string, caseId: string) => (await call<CaseRow>(token, 'GET', `/v2/rcas/${caseId}`)).body;

/** One move; the answer is returned for the caller to assert on. */
export async function moveCase(token: string, caseId: string, body: { to: string; note?: string; residualRisk?: string }) {
  const current = await caseOf(token, caseId);
  return call<CaseRow & { code?: string }>(token, 'POST', `/v2/rcas/${caseId}/transitions`, body, { 'If-Match': `"${current.rowVersion}"` });
}

/** The minimum a minor case needs to be accepted (CA7 tier 1: a method; a root cause). */
export async function prepareInvestigation(token: string, caseId: string, rootCause: string): Promise<void> {
  const current = await caseOf(token, caseId);
  const logicTree = current.logicTree.length >= 2
    ? current.logicTree
    : [
        { id: 'n1', parentId: null, label: 'Stop', kind: 'event', status: 'open', notes: null },
        { id: 'n2', parentId: 'n1', label: rootCause, kind: 'hypothesis', status: 'verified', notes: null },
      ];
  const patched = await call(token, 'PATCH', `/v2/rcas/${caseId}`, { consequenceClass: 'minor', rootCause: current.rootCause ?? rootCause, logicTree }, { 'If-Match': `"${current.rowVersion}"` });
  expect(patched.status, JSON.stringify(patched.body)).toBe(200);
}

interface CauseCodeRow {
  id: string;
  isActive: boolean;
}

/** An active RCA cause code of the plant; created by `codeAdmin` (a master-data writer) when there is none. */
export async function ensureCauseCode(token: string, codeAdmin: string): Promise<string> {
  const listed = await call<{ items: CauseCodeRow[] }>(token, 'GET', '/v2/rca-causes?status=active&limit=1');
  const found = listed.body.items?.find((code) => code.isActive);
  if (found) return found.id;
  const created = await command<CauseCodeRow>(codeAdmin, '/v2/rca-causes', { code: 'E2E-ROOT', name: 'E2E root cause', category: 'Equipment' });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body.id;
}

/**
 * Item 7: a case opened since typed causes exist needs a `root` cause with a cause code before closure is
 * requested. Adds one (idempotent: a coded root cause already on the case is kept).
 */
export async function addCodedRootCause(writer: string, codeAdmin: string, caseId: string, statement: string): Promise<void> {
  const causes = await call<Array<{ kind: string; causeCodeId: string | null }>>(writer, 'GET', `/v2/rcas/${caseId}/causes`);
  if (causes.body.some((cause) => cause.kind === 'root' && cause.causeCodeId)) return;
  const causeCodeId = await ensureCauseCode(writer, codeAdmin);
  const added = await command(writer, `/v2/rcas/${caseId}/causes`, { kind: 'root', causeCodeId, statement });
  expect(added.status, JSON.stringify(added.body)).toBe(201);
}

/** From Draft / In Progress / Analysis to Monitoring (investigation accepted). */
export async function acceptInvestigation(token: string, caseId: string): Promise<void> {
  const path: Record<string, string> = { Draft: 'In Progress', 'In Progress': 'Analysis', Analysis: 'Monitoring', Published: 'Monitoring' };
  for (let step = 0; step < 4; step += 1) {
    const { status } = await caseOf(token, caseId);
    if (status === 'Monitoring') return;
    const moved = await moveCase(token, caseId, { to: path[status] ?? 'Analysis' });
    expect(moved.status, JSON.stringify(moved.body)).toBe(200);
  }
}

/**
 * CA4: verified actions are marked done with evidence by `verifier` (never their owner); the others are
 * cancelled by `writer`. Actions whose verification is planned but not due are left as they are.
 */
export async function finishActions(writer: string, verifier: string, caseId: string): Promise<void> {
  const actions = (await call<ActionRow[]>(writer, 'GET', `/v2/rcas/${caseId}/actions`)).body;
  for (const action of actions.filter((a) => a.status !== 'done' && a.status !== 'cancelled')) {
    const verified = action.verificationStatus === 'evaluated';
    const body = verified
      ? { status: 'done', actionType: 'repair', completionEvidenceRef: 'E2E work order WO-1 and acceptance test' }
      : { status: 'cancelled' };
    const token = verified ? verifier : writer;
    const done = await call(token, 'PATCH', `/v2/rca-actions/${action.id}`, body, { 'If-Match': `"${action.rowVersion}"` });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
  }
}

/** A verified action of a case (past window, server-counted baseline, verified now). */
export async function addVerifiedAction(token: string, caseId: string, title: string): Promise<void> {
  const now = Date.now();
  const created = await command<ActionRow>(token, `/v2/rcas/${caseId}/actions`, {
    title,
    verificationWindowStart: new Date(now - 40 * 86_400_000).toISOString(),
    verificationWindowEnd: new Date(now - 86_400_000).toISOString(),
    baseline: { metric: 'recurrences' },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const verified = await command(token, `/v2/rca-actions/${created.body.id}/verify`, {}, { 'If-Match': `"${created.body.rowVersion}"` });
  expect(verified.status, JSON.stringify(verified.body)).toBe(200);
}
