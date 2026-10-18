import { RCA } from '../rca/rca.entity';
import { RcaCaseListFacts } from './rca-case-list-facts';
import { RecommendationActionRef } from './recommendation-actions';
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

/**
 * A row of `GET /v2/rcas` (U3): the summary plus the first linked event (null without one) and the action
 * counts, read for the whole page in one query.
 */
export type RcaCaseListItemV2View = RcaCaseSummaryV2View & RcaCaseListFacts;

/** A case recommendation with the actions implementing it (item 5; read-only, ignored on write). */
export interface RcaRecommendationV2Item extends RcaRecommendationItem {
  actions: RecommendationActionRef[];
}

/** One case with its nested content (plan 3.9 step 1: everything the form edits round-trips). */
export interface RcaCaseV2View extends RcaCaseSummaryV2View {
  description: string | null;
  teamMemberIds: string[];
  rootCause: string | null;
  templateId: string | null;
  recommendations: RcaRecommendationV2Item[];
  evidence: RcaEvidenceItem[];
  logicTree: RcaLogicNode[];
  teamCharter: string | null;
  eventDiagram: RcaEventDiagram;
  /** who opened the case (null: a trigger or before CA1) */
  createdBy: string | null;
  /** CA7 consequence class → investigation tier */
  consequenceClass: string | null;
  /** CA1 closure: residual risk, request, independent approval, the reviewer's note */
  residualRisk: string | null;
  closureRequestedBy: string | null;
  closureRequestedAt: string | null;
  closureApprovedBy: string | null;
  closureApprovedAt: string | null;
  closureNote: string | null;
  /** CA2 effectiveness frozen when closure was requested */
  effectivenessVerdict: string | null;
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

export function toRcaCaseView(
  rca: RCA,
  actions: ReadonlyMap<string, RecommendationActionRef[]> = new Map(),
): RcaCaseV2View {
  return {
    ...toRcaCaseSummary(rca),
    description: rca.description ?? null,
    teamMemberIds: readIds(rca.teamMemberIds),
    rootCause: rca.rootCause ?? null,
    templateId: rca.templateId ?? null,
    recommendations: readRecommendations(rca.recommendations).map((item) => ({
      ...item,
      actions: actions.get(item.id) ?? [],
    })),
    evidence: readEvidence(rca.evidence),
    logicTree: readLogicTree(rca.logicTree),
    teamCharter: rca.teamCharter ?? null,
    eventDiagram: readEventDiagram(rca.eventDiagram),
    createdBy: rca.createdBy ?? null,
    consequenceClass: rca.consequenceClass ?? null,
    residualRisk: rca.residualRisk ?? null,
    closureRequestedBy: rca.closureRequestedBy ?? null,
    closureRequestedAt: iso(rca.closureRequestedAt),
    closureApprovedBy: rca.closureApprovedBy ?? null,
    closureApprovedAt: iso(rca.closureApprovedAt),
    closureNote: rca.closureNote ?? null,
    effectivenessVerdict: rca.effectivenessVerdict ?? null,
  };
}
