import { Link } from 'react-router-dom';
import { useRcaAnalyses } from '@/api/v2/queries/rca-cases';
import { Section } from '@/features/ux-kit/page-layout';
import { ANALYSIS_TOOLS, toolStatus } from '../../model/analysis-tools';
import { useCaseWorkspace } from '../case-context';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

/** `/rca/:caseId/analysis`: the nine analysis methods of the case; each opens its own page. */
export function AnalysisIndexPage() {
  const { text } = useNumberFormat();
  const { rca, basePath } = useCaseWorkspace();
  const analyses = useRcaAnalyses(rca.id);
  return (
    <Section title="Analysis methods" description="Use the methods that fit the problem; the root cause is written on the overview.">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="analysis-tools">
        {ANALYSIS_TOOLS.map((tool) => (
          <li key={tool.slug}>
            <Link
              to={`${basePath}/analysis/${tool.slug}`}
              className="block h-full rounded border p-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid={`tool-${tool.slug}`}
            >
              <span className="block font-medium">{tool.name}</span>
              <span className="block text-sm text-muted-foreground">{tool.description}</span>
              <span className="mt-2 block text-xs">{text(toolStatus(tool, rca, analyses.data))}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
