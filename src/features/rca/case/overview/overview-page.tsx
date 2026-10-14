import { useState } from 'react';
import { useRcaAnalyses } from '@/api/v2/queries/rca-cases';
import type { RcaCaseView } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Section } from '@/features/ux-kit/page-layout';
import { StatusIcon } from '@/lib/icons';
import { progressSteps } from '../../model/case-progress';
import { useRcaFormat } from '../../use-rca-format';
import { buildDefinitionPatch, formFromCase, type RcaCaseForm } from '../../model/rca-form';
import { useCaseWorkspace } from '../case-context';
import { useCasePatch } from '../use-case-patch';
import { TEAM_LOCKED_STATUSES } from '../../model/case-workflow';
import { WorkflowPanel } from '../workflow/workflow-panel';
import { DefinitionFields } from './definition-fields';
import { TeamEditor } from './team-editor';

function Progress({ rca }: { rca: RcaCaseView }) {
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
            <span className="text-xs text-muted-foreground">{step.hint}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Overview of a case: progress, the workflow, the definition (incl. charter and root cause) and the team. */
export function OverviewPage() {
  const { rca, readOnly } = useCaseWorkspace();
  const { timezone } = useRcaFormat();
  const patch = useCasePatch();
  const [form, setForm] = useState<RcaCaseForm>(() => formFromCase(rca, timezone));
  const [saved, setSaved] = useState(false);
  const change = (next: Partial<RcaCaseForm>) => {
    setSaved(false);
    setForm((current) => ({ ...current, ...next }));
  };
  const teamLocked = TEAM_LOCKED_STATUSES.includes(rca.status ?? '');
  const save = async () => {
    const result = await patch.save(buildDefinitionPatch(form, timezone)).catch(() => null);
    if (!result) return;
    setForm(formFromCase(result, timezone));
    setSaved(true);
  };
  return (
    <>
      <Section title="Progress" description="A guide through the investigation; nothing here blocks a step.">
        <Progress rca={rca} />
      </Section>
      <WorkflowPanel />
      <Section title="Definition" description="The status moves only through the workflow above.">
        <DefinitionFields form={form} onChange={change} readOnly={readOnly} />
      </Section>
      <Section title="Team" description={teamLocked ? 'Fixed since the investigation was accepted, so the closure approver is judged against a known team. Reopen the case to change it.' : undefined}>
        <TeamEditor value={form} onChange={(team) => change(team)} readOnly={readOnly || teamLocked} />
      </Section>
      {patch.error ? <FriendlyErrorAlert error={patch.error} /> : null}
      {!readOnly && (
        <div className="flex items-center gap-2">
          <Button disabled={form.title.trim() === '' || patch.isPending} onClick={() => void save()} data-testid="save-case">
            Save case
          </Button>
          {saved && (
            <span role="status" className="text-sm text-muted-foreground">
              Saved.
            </span>
          )}
        </div>
      )}
    </>
  );
}
