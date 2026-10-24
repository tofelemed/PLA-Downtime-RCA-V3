import { Link } from 'react-router-dom';
import { useRcaAnalyses } from '@/api/v2/queries/rca-cases';
import { ReportCard } from '@/features/pla-analytics/components/report-card';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { StatusIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { ANALYSIS_TOOLS, toolStatus, type AnalysisTool } from '../../model/analysis-tools';
import { useCaseWorkspace } from '../case-context';
import { CausesPanel } from '../causes/causes-panel';

/** The status line of a tile: a check for a started method, a dash for one not started (the words say it either way). */
function ToolStatus({ status }: { status: string }) {
  const { text } = useNumberFormat();
  const started = status !== 'Not started' && status !== '…';
  const Icon = started ? StatusIcon.success : StatusIcon.pending;
  return (
    <span className={cn('mt-auto inline-flex items-center gap-1.5 pt-3 text-xs', started ? 'font-medium' : 'text-muted-foreground')} data-testid="tool-status">
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {text(status)}
    </span>
  );
}

function ToolTile({ tool, status, to }: { tool: AnalysisTool; status: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex h-full flex-col rounded-md border bg-background p-3 transition-colors hover:border-primary/60 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid={`tool-${tool.slug}`}
    >
      <span className="block font-medium text-heading">{tool.name}</span>
      <span className="block text-sm text-muted-foreground">{tool.description}</span>
      <ToolStatus status={status} />
    </Link>
  );
}

/** `/rca/:caseId/analysis`: the nine analysis methods of the case (each opens its own page) and its typed causes. */
export function AnalysisIndexPage() {
  const { rca, basePath } = useCaseWorkspace();
  const analyses = useRcaAnalyses(rca.id);
  return (
    <div className="space-y-6">
      <ReportCard
        title="Analysis methods"
        info="Use the methods that fit the problem; write the agreed root-cause narrative in the case definition, and record the coded causes below."
        actions={
          <Link to={`${basePath}/definition`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Case definition
          </Link>
        }
      >
        <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="analysis-tools">
          {ANALYSIS_TOOLS.map((tool) => (
            <li key={tool.slug}>
              <ToolTile tool={tool} status={toolStatus(tool, rca, analyses.data)} to={`${basePath}/analysis/${tool.slug}`} />
            </li>
          ))}
        </ul>
      </ReportCard>
      <CausesPanel />
    </div>
  );
}
