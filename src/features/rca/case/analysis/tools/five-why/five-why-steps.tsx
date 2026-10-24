import { useState } from 'react';
import type { FiveWhyContent, FiveWhyLevel } from '@/api/v2/types/rca-analyses';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { IconButton } from '@/features/ux-kit/icon-button';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionIcon } from '@/lib/icons';
import { useCaseWorkspace } from '../../../case-context';
import { ToolTextField } from '../tool-fields';
import { levelHasText, removeLevel, setAnswer, setJustification } from './five-why-model';

interface StepProps {
  level: FiveWhyLevel;
  index: number;
  last: boolean;
  removable: boolean;
  onAnswer: (answer: string) => void;
  onJustification: (justification: string) => void;
  onRemove: () => void;
}

/** One "why" of the vertical stepper: the numbered marker and line on the left, question, answer and evidence on the right. */
function WhyStep({ level, index, last, removable, onAnswer, onJustification, onRemove }: StepProps) {
  const { number } = useNumberFormat();
  return (
    <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3" data-testid="why-level">
      <div className="flex flex-col items-center" aria-hidden="true">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary text-sm font-semibold text-primary">{number(level.level)}</span>
        {!last && <span className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className="min-w-0 space-y-3 pb-5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-heading">
            Why {number(level.level)}
            <span className="block max-w-[75ch] font-normal text-muted-foreground">{level.question}</span>
          </h4>
          {removable && <IconButton icon={ActionIcon.delete} label={`Remove why ${level.level}`} onClick={onRemove} />}
        </div>
        <ToolTextField id={`why-answer-${index}`} label="Answer (cause found)" value={level.answer} maxLength={2000} onChange={onAnswer} />
        <ToolTextField id={`why-justification-${index}`} label="Evidence / justification" value={level.justification ?? ''} maxLength={2000} multiline onChange={onJustification} />
      </div>
    </li>
  );
}

/** 5-Why steps as a numbered vertical stepper (Why 1 … n); removing a filled step is confirmed first. */
export function FiveWhySteps({ content, onChange }: { content: FiveWhyContent; onChange: (next: FiveWhyContent) => void }) {
  const { number } = useNumberFormat();
  const { readOnly } = useCaseWorkspace();
  const levels = content.whyLevels;
  const set = (whyLevels: FiveWhyContent['whyLevels']) => onChange({ ...content, whyLevels });
  const [removing, setRemoving] = useState<number | null>(null);
  const remove = (index: number) => (levelHasText(levels[index]) ? setRemoving(index) : set(removeLevel(levels, index)));
  return (
    <>
      {removing !== null && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title={`Remove why ${number(removing + 1)}?`}
          description="Its answer and evidence are removed and the later levels are renumbered. Nothing is saved until you save the 5-Why."
          confirmLabel="Remove level"
          destructive
          onConfirm={() => set(removeLevel(levels, removing))}
        />
      )}
      <ol aria-label="Why steps">
        {levels.map((level, index) => (
          <WhyStep
            key={level.level}
            level={level}
            index={index}
            last={index === levels.length - 1}
            removable={!readOnly && levels.length > 1}
            onAnswer={(answer) => set(setAnswer(levels, index, answer))}
            onJustification={(justification) => set(setJustification(levels, index, justification))}
            onRemove={() => remove(index)}
          />
        ))}
      </ol>
    </>
  );
}
