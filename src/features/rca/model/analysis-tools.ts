import type { RcaAnalysesView, RcaRecordTool } from '@/api/v2/types/rca-analyses';
import type { RcaCaseView } from '@/api/v2/types/rca';

/** The nine RCA analysis methods; each is a sub-page `/rca/:caseId/analysis/:tool`. */
export type AnalysisToolSlug =
  | 'logic-tree'
  | 'event-diagram'
  | 'timeline'
  | 'five-why'
  | 'fishbone'
  | 'fmea'
  | 'fault-tree'
  | 'barrier'
  | 'change';

export interface AnalysisTool {
  slug: AnalysisToolSlug;
  name: string;
  description: string;
  /** the tool's own record; tools without one are stored with the case */
  record: RcaRecordTool | null;
}

export const ANALYSIS_TOOLS: readonly AnalysisTool[] = [
  { slug: 'logic-tree', name: 'Logic tree', description: 'Failure, modes, hypotheses and verified causes, with evidence.', record: null },
  { slug: 'event-diagram', name: 'Event diagram', description: 'Events before the failure and how they connect.', record: null },
  { slug: 'timeline', name: 'Event timeline', description: 'Diagram events and linked production events in time order.', record: null },
  { slug: 'five-why', name: '5-Why', description: 'Ask why until the root cause is reached.', record: 'fiveWhy' },
  { slug: 'fishbone', name: 'Fishbone', description: 'Causes grouped by the 6M categories.', record: 'fishbone' },
  { slug: 'fmea', name: 'FMEA', description: 'Failure effects and causes ranked by risk priority number.', record: 'fmea' },
  { slug: 'fault-tree', name: 'Fault tree', description: 'Top event broken down through AND / OR gates.', record: 'faultTree' },
  { slug: 'barrier', name: 'Barrier analysis', description: 'Barriers that failed or were weak.', record: 'barrier' },
  { slug: 'change', name: 'Change analysis', description: 'Changes that may have contributed.', record: 'change' },
];

export const toolOf = (slug: string | undefined): AnalysisTool | undefined => ANALYSIS_TOOLS.find((tool) => tool.slug === slug);

/** Short status of a tool for the analysis index ("3 nodes", "Saved", "Not started"). */
export function toolStatus(tool: AnalysisTool, rca: RcaCaseView, analyses: RcaAnalysesView | undefined): string {
  if (tool.slug === 'logic-tree') return rca.logicTree.length ? `${rca.logicTree.length} node(s)` : 'Not started';
  if (tool.slug === 'event-diagram' || tool.slug === 'timeline') {
    return rca.eventDiagram.nodes.length ? `${rca.eventDiagram.nodes.length} event(s)` : 'Not started';
  }
  if (!tool.record) return 'Not started';
  if (!analyses) return '…';
  return analyses[tool.record] ? 'Saved' : 'Not started';
}
