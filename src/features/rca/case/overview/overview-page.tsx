import { useRcaAnalyses } from '@/api/v2/queries/rca-cases';
import type { RcaCaseView } from '@/api/v2/types/rca';
import { Section } from '@/features/ux-kit/page-layout';
import { StatusIcon } from '@/lib/icons';
import { progressSteps } from '../../model/case-progress';
import { useCaseWorkspace } from '../case-context';
import { WorkflowPanel } from '../workflow/workflow-panel';
import { DefinitionSummary } from './definition-summary';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

function Progress({ rca }: { rca: RcaCaseView }) {
  const { text } = useNumberFormat();
  const analyses = useRcaAnalyses(rca.id);
  const hasRecord = Object.values(analyses.data ?? {}).some((record) => record !== null);
  return (
    <ol className="grid gap-2 sm:grid-cols-5" data-testid="case-progress">
      {progressSteps(rca, hasRecord).map((step) => {
        const Icon = step.done ? StatusIcon.success : StatusIcon.pending;
        return (
          <li key={step.key} className="rounded border p-2 text-sm">
            <span className="flex items-center gap-1 font-medium">
              <Icon aria-hidden="true" className="h-4 w-4" />
              {step.label}
              <span className="sr-only">{step.done ? '(done)' : '(open)'}</span>
            </span>
            <span className="text-xs text-muted-foreground">{text(step.hint)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Overview of a case: progress, workflow and saved definition/team facts. */
export function OverviewPage() {
  const { rca } = useCaseWorkspace();
  return (
    <>
      <Section title="Progress" description="A guide through the investigation; nothing here blocks a step.">
        <Progress rca={rca} />
      </Section>
      <WorkflowPanel />
      <DefinitionSummary />
    </>
  );
}
