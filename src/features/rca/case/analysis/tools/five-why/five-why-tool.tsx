import { useState } from 'react';
import type { FiveWhyContent } from '@/api/v2/types/rca-analyses';
import { Button } from '@/components/ui/button';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionIcon } from '@/lib/icons';
import { useRcaReadiness } from '@/api/v2/queries/rca-cases';
import { useCaseWorkspace } from '../../../case-context';
import { useCasePatch } from '../../../use-case-patch';
import { CopyReportButton } from '../copy-report-button';
import { ToolChecklist } from '../tool-checklist';
import { useToolDraft } from '../tool-draft';
import { ToolTextField } from '../tool-fields';
import { SaveBar, ToolFrame, type ToolRecord } from '../tool-record';
import { ApplyRootCause } from './apply-root-cause';
import { FiveWhySteps } from './five-why-steps';
import { addLevel, applyByDefault, depthCount, depthGuidance, fiveWhyChecks, fiveWhyReport, firstLevel } from './five-why-model';

/** The case policy's 5-Why rules from the readiness answer: depth guideline and refused root-cause phrases. */
function useFiveWhyRules(rcaId: string) {
  const rules = useRcaReadiness(rcaId).data?.rules;
  return { guideline: rules?.fiveWhyGuidelineLevels ?? null, unsupported: rules?.fiveWhyUnsupportedRootCauses ?? [] };
}

function StepsTitle({ levels, guideline }: { levels: number; guideline: number | null }) {
  const { text } = useNumberFormat();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-sm font-semibold text-heading">Why steps</h3>
      <KpiInfo label="Why steps" text={`${text(depthGuidance(levels, guideline))} A bare "operator error" is not accepted as the root cause.`} />
      <span className="text-sm text-muted-foreground" data-testid="five-why-guidance">
        {text(depthCount(levels, guideline))}
      </span>
    </div>
  );
}

function useFiveWhySave(record: ToolRecord<'fiveWhy'>, content: FiveWhyContent, save: (body: FiveWhyContent) => Promise<unknown>) {
  const { rca } = useCaseWorkspace();
  const patch = useCasePatch();
  const [apply, setApply] = useState(() => applyByDefault(rca.rootCause, record?.rootCause));
  const [error, setError] = useState<unknown>(null);
  const onSave = async () => {
    setError(null);
    await save(content);
    const rootCause = content.rootCause.trim();
    if (!apply || !rootCause || rootCause === (rca.rootCause ?? '')) return;
    // the 5-Why is saved at this point; a refused root-cause update is reported on its own
    await patch.save({ rootCause }).catch((failure: unknown) => setError(failure));
  };
  return { apply, setApply, error, onSave };
}

function Editor({ record, save }: { record: ToolRecord<'fiveWhy'>; save: (body: FiveWhyContent) => Promise<unknown> }) {
  const { rca, readOnly } = useCaseWorkspace();
  const { guideline, unsupported } = useFiveWhyRules(rca.id);
  const [content, setContent] = useToolDraft<FiveWhyContent>(() => ({
    problem: record?.problem ?? rca.description ?? rca.title,
    whyLevels: record?.whyLevels ?? [firstLevel()],
    rootCause: record?.rootCause ?? '',
  }));
  const run = useFiveWhySave(record, content, save);
  const last = content.whyLevels[content.whyLevels.length - 1];
  return (
    <div className="space-y-5" data-testid="five-why-tool">
      <ToolTextField id="why-problem" label="Problem statement" value={content.problem} maxLength={4000} multiline onChange={(problem) => setContent({ ...content, problem })} />
      <div className="space-y-3">
        <StepsTitle levels={content.whyLevels.length} guideline={guideline} />
        <FiveWhySteps content={content} onChange={setContent} />
        {!readOnly && (
          <Button type="button" variant="outline" className="h-9" disabled={!last?.answer.trim() || content.whyLevels.length >= 20} onClick={() => setContent({ ...content, whyLevels: addLevel(content.whyLevels) })}>
            <ActionIcon.add aria-hidden="true" className="h-4 w-4" />
            Ask another why
          </Button>
        )}
      </div>
      <div className="space-y-2 rounded-md border bg-muted/30 p-3">
        <ToolTextField id="why-root-cause" label="Root cause" value={content.rootCause} maxLength={4000} multiline onChange={(rootCause) => setContent({ ...content, rootCause })} />
        {!readOnly && last?.answer.trim() && (
          <Button type="button" variant="ghost" className="h-9" onClick={() => setContent({ ...content, rootCause: last.answer })}>
            Use the last answer
          </Button>
        )}
        {!readOnly && <ApplyRootCause checked={run.apply} onChange={run.setApply} current={rca.rootCause} error={run.error} />}
      </div>
      <ToolChecklist items={fiveWhyChecks(content, unsupported)} />
      <div className="flex flex-wrap items-start justify-between gap-3 border-t pt-3">
        <SaveBar onSave={run.onSave} disabled={content.problem.trim() === ''} hint="Write the problem statement first." label="Save 5-Why" updatedAt={record?.updatedAt} />
        <CopyReportButton text={() => fiveWhyReport(content)} />
      </div>
    </div>
  );
}

/** 5-Why: ask why until the root cause; the answer can become the case's root cause. */
export function FiveWhyTool() {
  return <ToolFrame tool="fiveWhy">{(record, save) => <Editor record={record} save={save} />}</ToolFrame>;
}
