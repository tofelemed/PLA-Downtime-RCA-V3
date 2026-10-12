import type { RcaCaseView } from '@/api/v2/types/rca';

/** Names for ids in an export (users, assets); the export never writes a raw id where a name exists. */
export interface ExportNames {
  user: (id: string | null) => string;
  asset: (id: string | null) => string;
  unit: (id: string | null) => string;
}

const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const row = (values: unknown[]) => values.map(cell).join(',');

/** The case as a readable JSON document (names instead of ids; dates stay ISO / UTC). */
export function caseJson(rca: RcaCaseView, names: ExportNames): string {
  const document = {
    title: rca.title,
    status: rca.status,
    priority: rca.priority,
    unit: names.unit(rca.unitId),
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
    createdAt: rca.createdAt,
    updatedAt: rca.updatedAt,
  };
  return JSON.stringify(document, null, 2);
}

/** Recommendations as CSV (title, description, priority, owner, due, status, estimated cost). */
export function recommendationsCsv(rca: RcaCaseView, names: ExportNames): string {
  const header = row(['Title', 'Description', 'Priority', 'Owner', 'Due date', 'Status', 'Estimated cost']);
  const lines = rca.recommendations.map((r) =>
    row([r.title, r.description, r.priority, names.user(r.ownerId), r.dueDate, r.status, r.estimatedCost]),
  );
  return [header, ...lines].join('\n');
}

/** Evidence as CSV (title, type, 5P, category, location, severity, verified, task, status). */
export function evidenceCsv(rca: RcaCaseView): string {
  const header = row(['Title', 'Type', '5P', 'Category', 'Location', 'Severity', 'Verified', 'Task', 'Task status', 'Task due']);
  const lines = rca.evidence.map((e) =>
    row([e.title, e.type, e.fiveP, e.category, e.location, e.severity, e.verified ? 'Yes' : 'No', e.task, e.taskStatus, e.taskDueDate]),
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
