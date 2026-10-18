import type { RcaActionView, RcaCaseView, RcaLinkView, RcaOutcomeView } from '@/api/v2/types/rca';
import type { RcaCaseCauseView } from '@/api/v2/types/rca-causes';
import { plantDayOf } from './plant-day';

/** Names for ids in an export (users, assets); the export never writes a raw id where a name exists. */
export interface ExportNames {
  user: (id: string | null) => string;
  asset: (id: string | null) => string;
  unit: (id: string | null) => string;
}

const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const row = (values: unknown[]) => values.map(cell).join(',');

/** The case's records beside the case document (read from their own endpoints when the export runs). */
export interface CaseExportRecords {
  actions: RcaActionView[];
  causes: RcaCaseCauseView[];
  links: RcaLinkView[];
  outcome: RcaOutcomeView | null;
}

function actionsOf(actions: RcaActionView[], names: ExportNames) {
  return actions.map((a) => ({
    title: a.title,
    status: a.status,
    type: a.actionType,
    owner: names.user(a.ownerId),
    dueDate: a.dueDate,
    recommendationId: a.recommendationId,
    verificationMethod: a.verificationMethod,
    verifier: a.verifierId ? names.user(a.verifierId) : null,
    completionEvidence: a.completionEvidenceRef,
    completedAt: a.completedAt,
    evidenceCheckedBy: a.completionVerifiedBy ? names.user(a.completionVerifiedBy) : null,
    verificationWindow: { from: a.verificationWindowStart, to: a.verificationWindowEnd },
    baseline: a.baseline,
    verdict: a.verdict,
    effectiveness: a.postAction?.effectiveness ?? null,
    claimedAvoidedLoss: a.claimedAvoidedLoss,
    cancelReason: a.cancelReason,
  }));
}

function recordsOf(records: CaseExportRecords, names: ExportNames) {
  return {
    actions: actionsOf(records.actions, names),
    causes: records.causes.map((c) => ({ kind: c.kind, rootCause: c.kind === 'root', code: c.causeCode?.code ?? null, codeName: c.causeCode?.name ?? null, statement: c.statement, evidenceIds: c.evidenceIds })),
    links: records.links.map((l) => ({ type: l.linkType, targetId: l.targetId, unit: names.unit(l.unitId), linkedBy: names.user(l.linkedBy), linkedAt: l.linkedAt, reason: l.reason })),
    outcome: records.outcome,
  };
}

/**
 * The case as a readable JSON document (names instead of ids; dates stay ISO / UTC, the plant zone is
 * named): the case, its actions, typed causes (root cause marked), links, closure and the outcome.
 */
export function caseJson(rca: RcaCaseView, names: ExportNames, records: CaseExportRecords, timeZone: string): string {
  const document = {
    title: rca.title,
    status: rca.status,
    priority: rca.priority,
    consequenceClass: rca.consequenceClass,
    unit: names.unit(rca.unitId),
    plantTimeZone: timeZone,
    teamLead: names.user(rca.teamLeadId),
    team: rca.teamMemberIds.map(names.user),
    targetCloseDate: rca.targetCloseDate,
    actualCloseDate: rca.actualCloseDate,
    problem: rca.description,
    teamCharter: rca.teamCharter,
    rootCause: rca.rootCause,
    evidence: rca.evidence.map(({ nodeIds: _nodes, collectedBy, assetId, ...item }) => ({
      ...item,
      collectedBy: names.user(collectedBy),
      asset: names.asset(assetId),
    })),
    logicTree: rca.logicTree,
    eventDiagram: rca.eventDiagram,
    recommendations: rca.recommendations.map(({ ownerId, ...item }) => ({ ...item, owner: names.user(ownerId) })),
    ...recordsOf(records, names),
    closure: {
      residualRisk: rca.residualRisk,
      requestedBy: rca.closureRequestedBy ? names.user(rca.closureRequestedBy) : null,
      requestedAt: rca.closureRequestedAt,
      approvedBy: rca.closureApprovedBy ? names.user(rca.closureApprovedBy) : null,
      approvedAt: rca.closureApprovedAt,
      note: rca.closureNote,
      effectivenessVerdict: rca.effectivenessVerdict,
    },
    createdAt: rca.createdAt,
    updatedAt: rca.updatedAt,
  };
  return JSON.stringify(document, null, 2);
}

/**
 * Recommendations as CSV (title, description, priority, owner, due, status, estimated cost): the due day in
 * plant time with the zone in the header, and the stored instant as ISO / UTC (the export convention).
 */
export function recommendationsCsv(rca: RcaCaseView, names: ExportNames, timeZone: string): string {
  const header = row(['Title', 'Description', 'Priority', 'Owner', `Due date (${timeZone})`, 'Due (UTC)', 'Status', 'Estimated cost']);
  const lines = rca.recommendations.map((r) =>
    row([r.title, r.description, r.priority, names.user(r.ownerId), plantDayOf(r.dueDate, timeZone), r.dueDate, r.status, r.estimatedCost]),
  );
  return [header, ...lines].join('\n');
}

/** Evidence as CSV (title, type, 5P, category, location, severity, verified and by whom, task, assignee, status, due). */
export function evidenceCsv(rca: RcaCaseView, names: ExportNames): string {
  const header = row(['Title', 'Type', '5P', 'Category', 'Location', 'Severity', 'Verified', 'Verified by', 'Task', 'Task assignee', 'Task status', 'Task due']);
  const lines = rca.evidence.map((e) =>
    row([e.title, e.type, e.fiveP, e.category, e.location, e.severity, e.verified ? 'Yes' : 'No', e.verifiedBy ? names.user(e.verifiedBy) : '', e.task, e.taskAssigneeId ? names.user(e.taskAssigneeId) : '', e.taskStatus, e.taskDueDate]),
  );
  return [header, ...lines].join('\n');
}

/** A file name from the case title (letters, digits and dashes). */
export const exportName = (rca: RcaCaseView, suffix: string) =>
  `rca-${rca.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'case'}-${suffix}`;

/** Saves text as a file through a temporary link (no server round trip). */
export function downloadText(content: string, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
