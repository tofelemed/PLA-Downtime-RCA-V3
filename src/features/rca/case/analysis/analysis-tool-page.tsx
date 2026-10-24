import { lazy, type ComponentType } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ReportCard } from '@/features/pla-analytics/components/report-card';
import { UiIcon } from '@/lib/icons';
import { toolOf, type AnalysisToolSlug } from '../../model/analysis-tools';
import { useCaseWorkspace } from '../case-context';

const named = <T,>(load: () => Promise<T>, name: keyof T) =>
  lazy(async () => ({ default: (await load())[name] as unknown as ComponentType }));

/** Each tool is its own chunk (the event diagram brings the diagram library). */
const TOOLS: Record<AnalysisToolSlug, ComponentType> = {
  'logic-tree': named(() => import('./tools/logic-tree/logic-tree-tool'), 'LogicTreeTool'),
  'event-diagram': named(() => import('./tools/event-diagram/event-diagram-tool'), 'EventDiagramTool'),
  timeline: named(() => import('./tools/timeline/timeline-tool'), 'TimelineTool'),
  'five-why': named(() => import('./tools/five-why/five-why-tool'), 'FiveWhyTool'),
  fishbone: named(() => import('./tools/fishbone/fishbone-tool'), 'FishboneTool'),
  fmea: named(() => import('./tools/fmea/fmea-tool'), 'FmeaTool'),
  'fault-tree': named(() => import('./tools/fault-tree/fault-tree-tool'), 'FaultTreeTool'),
  barrier: named(() => import('./tools/barrier/barrier-tool'), 'BarrierTool'),
  change: named(() => import('./tools/change/change-tool'), 'ChangeTool'),
};

/** `/rca/:caseId/analysis/:tool`: one analysis method of the case, in a card with its ⓘ and the way back to all methods. */
export function AnalysisToolPage() {
  const { basePath } = useCaseWorkspace();
  const { tool: slug } = useParams();
  const tool = toolOf(slug);
  if (!tool) return <Navigate to={`${basePath}/analysis`} replace />;
  const Tool = TOOLS[tool.slug];
  return (
    <ReportCard
      title={tool.name}
      info={tool.description}
      testId="analysis-tool-card"
      actions={
        <Link className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline" to={`${basePath}/analysis`}>
          <UiIcon.previous aria-hidden="true" className="h-4 w-4" />
          All methods
        </Link>
      }
    >
      <Tool />
    </ReportCard>
  );
}
