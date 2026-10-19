import type { RcaActionView, RcaCaseView, RcaLinkView, RcaOutcomeView } from '@/api/v2/types/rca';
import type { RcaAnalysesView } from '@/api/v2/types/rca-analyses';
import type { RcaCaseCauseView } from '@/api/v2/types/rca-causes';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_ACTION_STATUS_LABELS, RCA_ACTION_TYPE_LABELS, RCA_EVIDENCE_TASK_LABELS, RCA_RECOMMENDATION_STATUS_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { EVIDENCE_REQUEST_LABELS as REQ } from './evidence-request-labels';
import type { HistoryExportRow } from './history-export';
import { plantDayOf } from './plant-day';
import { verificationLabel } from './rca-labels';

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
  /** every analysis tool record (QA M4: 5-Why, fishbone, FMEA, fault tree, barrier, change) */
  analyses: RcaAnalysesView | null;
  /** the investigation's History, newest first (QA M4) */
  history: HistoryExportRow[];
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
    analyses: analysesOf(records.analyses),
    history: records.history,
  };
}

/** A tool record's content without its bookkeeping (id, row version). */
function contentOf<T extends { id: string; rowVersion: number }>(record: T | null): Omit<T, 'id' | 'rowVersion'> | null {
  if (!record) return null;
  const { id: _id, rowVersion: _version, ...rest } = record;
  return rest;
}

const ANALYSIS_KEYS = ['fiveWhy', 'fishbone', 'fmea', 'faultTree', 'barrier', 'change'] as const;

/** Every analysis tool of the case (null = not started). */
function analysesOf(analyses: RcaAnalysesView | null) {
  return Object.fromEntries(ANALYSIS_KEYS.map((key) => [key, contentOf(analyses ? analyses[key] : null)]));
}

/**
 * The case as a readable JSON document (names instead of ids; dates stay ISO / UTC, the plant zone is
 * named): the case, its analyses (logic tree, event diagram and every tool), actions, typed causes (root
 * cause marked), links, closure, the outcome and the History.
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
    row([r.title, r.description, r.priority, names.user(r.ownerId), plantDayOf(r.dueDate, timeZone), r.dueDate, labelOf(RCA_RECOMMENDATION_STATUS_LABELS, r.status, 'Open'), r.estimatedCost]),
  );
  return [header, ...lines].join('\n');
}

/**
 * Evidence as CSV with the words of the evidence pages (QA M4): title, type, 5P, observed (plant time and
 * UTC), asset, category, location, severity, verified and by whom, the evidence request (request, from
 * whom, status, due) and the number of files.
 */
export function evidenceCsv(rca: RcaCaseView, names: ExportNames, plantTime: (iso: string) => string = (iso) => iso): string {
  const header = row(['Title', 'Type', '5P', 'Observed (plant time)', 'Observed (UTC)', 'Asset', 'Category', 'Location', 'Severity', 'Verified', 'Verified by', REQ.request, REQ.requestedFrom, REQ.status, REQ.due, 'Files']);
  const lines = rca.evidence.map((e) =>
    row([
      e.title,
      e.type ?? 'Note',
      e.fiveP,
      e.occurredAt ? plantTime(e.occurredAt) : '',
      e.occurredAt,
      e.assetId ? names.asset(e.assetId) : '',
      e.category,
      e.location,
      e.severity,
      e.verified ? 'Yes' : 'No',
      e.verifiedBy ? names.user(e.verifiedBy) : '',
      e.task,
      e.taskAssigneeId ? names.user(e.taskAssigneeId) : '',
      e.task || e.taskAssigneeId ? labelOf(RCA_EVIDENCE_TASK_LABELS, e.taskStatus, 'Pending') : '',
      e.taskDueDate,
      e.attachments.length,
    ]),
  );
  return [header, ...lines].join('\n');
}

/**
 * Actions as CSV (QA M4): title, type, status, owner, due day (plant time), the recommendation it carries
 * out, completion, verification in words (the verdict when one is recorded), claimed avoided loss and the
 * cancel reason — labels, never raw tokens or ids.
 */
export function actionsCsv(rca: RcaCaseView, actions: readonly RcaActionView[], names: ExportNames, timeZone: string): string {
  const recommendation = (id: string | null) => (id ? (rca.recommendations.find((r) => r.id === id)?.title ?? '') : '');
  const header = row(['Title', 'Type', 'Status', 'Owner', `Due date (${timeZone})`, 'Recommendation', 'Completed (UTC)', 'Verification', 'Claimed avoided loss', 'Currency', 'Cancel reason']);
  const lines = actions.map((a) =>
    row([
      a.title,
      a.actionType ? labelOf(RCA_ACTION_TYPE_LABELS, a.actionType) : '',
      labelOf(RCA_ACTION_STATUS_LABELS, a.status),
      a.ownerId ? names.user(a.ownerId) : '',
      plantDayOf(a.dueDate, timeZone),
      recommendation(a.recommendationId),
      a.completedAt,
      verificationLabel(a),
      a.claimedAvoidedLoss?.amount,
      a.claimedAvoidedLoss?.currency,
      a.cancelReason,
    ]),
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
