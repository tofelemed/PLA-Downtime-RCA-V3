import type { RcaCaseView, RcaEvidenceItem } from '@/api/v2/types/rca';

/**
 * Fills list fields a server older than this screen may leave out (evidence links, tags and files, the
 * event diagram), so a rolling deployment never breaks the case workspace. Values are never invented.
 */
export function normalizeCase(rca: RcaCaseView): RcaCaseView {
  const evidence = rca.evidence.map((item: Partial<RcaEvidenceItem> & Pick<RcaEvidenceItem, 'id' | 'title'>) => ({
    ...item,
    tags: item.tags ?? [],
    nodeIds: item.nodeIds ?? [],
    attachments: item.attachments ?? [],
    timeSeries: item.timeSeries ?? null,
  })) as RcaEvidenceItem[];
  return {
    ...rca,
    evidence,
    teamCharter: rca.teamCharter ?? null,
    eventDiagram: rca.eventDiagram ?? { nodes: [], edges: [] },
    // case workflow fields (RCA-01 / CA1) of a server older than this screen read as "not set"
    createdBy: rca.createdBy ?? null,
    consequenceClass: rca.consequenceClass ?? null,
    residualRisk: rca.residualRisk ?? null,
    closureRequestedBy: rca.closureRequestedBy ?? null,
    closureRequestedAt: rca.closureRequestedAt ?? null,
    closureApprovedBy: rca.closureApprovedBy ?? null,
    closureApprovedAt: rca.closureApprovedAt ?? null,
    closureNote: rca.closureNote ?? null,
    effectivenessVerdict: rca.effectivenessVerdict ?? null,
  };
}
