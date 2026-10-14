import { useState } from 'react';
import type { FiveWhyContent } from '@/api/v2/types/rca-analyses';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon } from '@/lib/icons';
import { useRcaReadiness } from '@/api/v2/queries/rca-cases';
import { useCaseWorkspace } from '../../../case-context';
import { useCasePatch } from '../../../use-case-patch';
import { CopyReportButton } from '../copy-report-button';
import { ToolChecklist } from '../tool-checklist';
import { SaveBar, ToolFrame, type ToolRecord } from '../tool-record';
import { addLevel, depthGuidance, fiveWhyChecks, fiveWhyReport, firstLevel, removeLevel, setAnswer, setJustification } from './five-why-model';

function Levels({ content, onChange, readOnly }: { content: FiveWhyContent; onChange: (next: FiveWhyContent) => void; readOnly: boolean }) {
  const levels = content.whyLevels;
  const set = (whyLevels: FiveWhyContent['whyLevels']) => onChange({ ...content, whyLevels });
  return (
    <ol className="space-y-3">
      {levels.map((level, index) => (
        <li key={level.level} className="space-y-2 rounded border p-3" data-testid="why-level">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">
              Why {level.level}: {level.question}
            </p>
            {!readOnly && levels.length > 1 && <IconButton icon={ActionIcon.delete} label={`Remove why ${level.level}`} onClick={() => set(removeLevel(levels, index))} />}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`why-answer-${index}`}>Answer (cause found)</Label>
            <Input id={`why-answer-${index}`} value={level.answer} maxLength={2000} disabled={readOnly} onChange={(e) => set(setAnswer(levels, index, e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`why-justification-${index}`}>Evidence / justification</Label>
            <Textarea
              id={`why-justification-${index}`}
              value={level.justification ?? ''}
              maxLength={2000}
              disabled={readOnly}
              onChange={(e) => set(setJustification(levels, index, e.target.value))}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Editor({ record, save }: { record: ToolRecord<'fiveWhy'>; save: (body: FiveWhyContent) => Promise<unknown> }) {
  const { rca, readOnly } = useCaseWorkspace();
  const guideline = useRcaReadiness(rca.id).data?.rules.fiveWhyGuidelineLevels ?? null;
  const patch = useCasePatch();
  const [content, setContent] = useState<FiveWhyContent>(() => ({
    problem: record?.problem ?? rca.description ?? rca.title,
    whyLevels: record?.whyLevels ?? [firstLevel()],
    rootCause: record?.rootCause ?? '',
  }));
  const [applyRootCause, setApplyRootCause] = useState(true);
  const last = content.whyLevels[content.whyLevels.length - 1];
  const onSave = async () => {
    await save(content);
    if (applyRootCause && content.rootCause.trim() && content.rootCause.trim() !== (rca.rootCause ?? '')) await patch.save({ rootCause: content.rootCause.trim() });
  };
  return (
    <div className="space-y-4" data-testid="five-why-tool">
      <div className="space-y-1">
        <Label htmlFor="why-problem">Problem statement</Label>
        <Textarea id="why-problem" value={content.problem} maxLength={4000} disabled={readOnly} onChange={(e) => setContent({ ...content, problem: e.target.value })} />
      </div>
      <Levels content={content} onChange={setContent} readOnly={readOnly} />
      {!readOnly && (
        <Button type="button" variant="outline" disabled={!last?.answer.trim() || content.whyLevels.length >= 20} onClick={() => setContent({ ...content, whyLevels: addLevel(content.whyLevels) })}>
          Ask another why
        </Button>
      )}
      <div className="space-y-1">
        <Label htmlFor="why-root-cause">Root cause</Label>
        <Textarea id="why-root-cause" value={content.rootCause} maxLength={4000} disabled={readOnly} onChange={(e) => setContent({ ...content, rootCause: e.target.value })} />
        {!readOnly && last?.answer.trim() && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setContent({ ...content, rootCause: last.answer })}>
            Use the last answer
          </Button>
        )}
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2">
          <Checkbox id="why-apply" checked={applyRootCause} onCheckedChange={(value) => setApplyRootCause(value === true)} />
          <Label htmlFor="why-apply">Also set it as the case's root cause</Label>
        </div>
      )}
      <ToolChecklist items={fiveWhyChecks(content)} />
      <p className="text-xs text-muted-foreground" data-testid="five-why-guidance">
        {depthGuidance(content.whyLevels.length, guideline)} A bare "operator error" is not accepted as the root cause.
      </p>
      <div className="flex flex-wrap items-start gap-3">
        <SaveBar onSave={onSave} disabled={content.problem.trim() === ''} hint="Write the problem statement first." label="Save 5-Why" updatedAt={record?.updatedAt} />
        <CopyReportButton text={() => fiveWhyReport(content)} />
      </div>
    </div>
  );
}

/** 5-Why: ask why until the root cause; the answer can become the case's root cause. */
export function FiveWhyTool() {
  return <ToolFrame tool="fiveWhy">{(record, save) => <Editor record={record} save={save} />}</ToolFrame>;
}
