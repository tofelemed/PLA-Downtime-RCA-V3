import { RCA } from '../rca/rca.entity';
import { RcaEventDiagram, readEventDiagram } from './rca-case-diagram';
import {
  RcaEvidenceItem,
  RcaLogicNode,
  RcaRecommendationItem,
  readEvidence,
  readIds,
  readLogicTree,
  readRecommendations,
} from './rca-case-json';

/** A case in lists (no nested content). */
export interface RcaCaseSummaryV2View {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  unitId: string | null;
  assetId: string | null;
  teamLeadId: string | null;
  targetCloseDate: string | null;
  actualCloseDate: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/** One case with its nested content (plan 3.9 step 1: everything the form edits round-trips). */
export interface RcaCaseV2View extends RcaCaseSummaryV2View {
  description: string | null;
  teamMemberIds: string[];
  rootCause: string | null;
  templateId: string | null;
  recommendations: RcaRecommendationItem[];
  evidence: RcaEvidenceItem[];
  logicTree: RcaLogicNode[];
  teamCharter: string | null;
  eventDiagram: RcaEventDiagram;
}

const iso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

export function toRcaCaseSummary(rca: RCA): RcaCaseSummaryV2View {
  return {
    id: rca.id,
    title: rca.title,
    status: rca.status ?? null,
    priority: rca.priority ?? null,
    unitId: rca.unitId ?? null,
    assetId: rca.assetId ?? null,
    teamLeadId: rca.teamLeadId ?? null,
    targetCloseDate: iso(rca.targetCloseDate),
    actualCloseDate: iso(rca.actualCloseDate),
    createdAt: iso(rca.createdAt) ?? '',
    updatedAt: iso(rca.updatedAt) ?? '',
    rowVersion: rca.rowVersion,
  };
}

export function toRcaCaseView(rca: RCA): RcaCaseV2View {
  return {
    ...toRcaCaseSummary(rca),
    description: rca.description ?? null,
    teamMemberIds: readIds(rca.teamMemberIds),
    rootCause: rca.rootCause ?? null,
    templateId: rca.templateId ?? null,
    recommendations: readRecommendations(rca.recommendations),
    evidence: readEvidence(rca.evidence),
    logicTree: readLogicTree(rca.logicTree),
    teamCharter: rca.teamCharter ?? null,
    eventDiagram: readEventDiagram(rca.eventDiagram),
  };
}
