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
  };
}
