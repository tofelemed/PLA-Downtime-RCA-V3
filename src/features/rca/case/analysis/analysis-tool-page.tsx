import { lazy, type ComponentType } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Section } from '@/features/ux-kit/page-layout';
import { toolOf, type AnalysisToolSlug } from '../../model/analysis-tools';
import { useCaseWorkspace } from '../case-context';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';

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

/** `/rca/:caseId/analysis/:tool`: one analysis method of the case. */
export function AnalysisToolPage() {
  const { basePath } = useCaseWorkspace();
  const { tool: slug } = useParams();
  const tool = toolOf(slug);
  if (!tool) return <Navigate to={`${basePath}/analysis`} replace />;
  const Tool = TOOLS[tool.slug];
  return (
    <Section
      title={tool.name}
      titleAside={<KpiInfo label={tool.name} text={tool.description} />}
      actions={
        <Link className="text-sm underline" to={`${basePath}/analysis`}>
          All methods
        </Link>
      }
    >
      <Tool />
    </Section>
  );
}
