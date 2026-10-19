import type { RcaDiagramNode, RcaEvidenceItem, RcaLinkView } from '@/api/v2/types/rca';
import { linkedEventKind } from './rca-labels';

/** One entry of the event timeline: a diagram event, or a production event linked to the case. */
export interface TimelineEntry {
  id: string;
  source: 'diagram' | 'linked';
  title: string;
  type: string | null;
  /** ISO instant; entries without a time are listed last */
  at: string | null;
  description: string | null;
  asset: string | null;
  severity: string | null;
  evidence: number;
}

interface LinkedEvent {
  start?: unknown;
  physicalType?: unknown;
}

interface CauseCodes {
  reasonCode?: { name?: unknown } | null;
}

const str = (value: unknown) => (typeof value === 'string' && value ? value : null);

function linkedEntry(link: RcaLinkView, evidence: readonly RcaEvidenceItem[]): TimelineEntry | null {
  const event = (link.evidence?.event ?? null) as LinkedEvent | null;
  if (link.linkType !== 'event' || !event) return null;
  const kind = linkedEventKind(event.physicalType);
  const reason = str(((link.evidence?.causeCodes ?? null) as CauseCodes | null)?.reasonCode?.name);
  return {
    id: link.id,
    source: 'linked',
    // QA L5: "Stop · Gearbox failure", never the stored entity name (`ProductionLoss`)
    title: reason ? `${kind} · ${reason}` : kind,
    type: `Linked ${kind.toLowerCase()}`,
    at: str(event.start),
    description: link.reason,
    asset: null,
    severity: null,
    evidence: evidence.filter((item) => item.nodeIds.includes(link.id)).length,
  };
}

/** Diagram events and linked production events in time order (v1 timeline sources). */
export function timelineOf(
  nodes: readonly RcaDiagramNode[],
  links: readonly RcaLinkView[],
  evidence: readonly RcaEvidenceItem[],
): TimelineEntry[] {
  const fromDiagram: TimelineEntry[] = nodes.map((node) => ({
    id: node.id,
    source: 'diagram',
    title: node.label,
    type: node.type,
    at: node.timestamp,
    description: node.description,
    asset: node.asset,
    severity: node.severity,
    evidence: evidence.filter((item) => item.nodeIds.includes(node.id)).length,
  }));
  const fromLinks = links.map((link) => linkedEntry(link, evidence)).filter((entry): entry is TimelineEntry => entry !== null);
  const time = (entry: TimelineEntry) => (entry.at ? Date.parse(entry.at) : Number.POSITIVE_INFINITY);
  return [...fromDiagram, ...fromLinks].sort((a, b) => time(a) - time(b));
}
