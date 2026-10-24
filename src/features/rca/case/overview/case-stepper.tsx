import { StatusIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import type { ProgressStep } from '../../model/case-progress';
import { CASE_STAGES, stageIndexOf, stageStateOf, type StageState } from '../../model/case-stages';
import { statusLabel } from '../../model/rca-labels';

const STATE_TEXT: Readonly<Record<StageState, string>> = { done: 'done', current: 'current stage', upcoming: 'to come' };

const DOT_CLASS: Readonly<Record<StageState, string>> = {
  done: 'border-success bg-success text-success-foreground',
  current: 'border-info bg-background text-info ring-2 ring-info/30',
  upcoming: 'border-border bg-background text-muted-foreground',
};

const LABEL_CLASS: Readonly<Record<StageState, string>> = {
  done: 'text-foreground',
  current: 'font-semibold text-foreground',
  upcoming: 'text-muted-foreground',
};

interface StageProps {
  label: string;
  state: StageState;
  index: number;
  last: boolean;
}

function Stage({ label, state, index, last }: StageProps) {
  const { number } = useNumberFormat();
  return (
    <li aria-current={state === 'current' ? 'step' : undefined} className={cn('flex min-w-0 items-center gap-2', !last && 'sm:flex-1')} data-state={state}>
      <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium', DOT_CLASS[state])}>
        {state === 'done' ? <StatusIcon.selected aria-hidden="true" className="h-3.5 w-3.5" /> : number(index + 1)}
      </span>
      <span className={cn('whitespace-nowrap text-sm', LABEL_CLASS[state])}>
        {label}
        <span className="sr-only"> ({STATE_TEXT[state]})</span>
      </span>
      {!last && <span aria-hidden="true" className={cn('hidden h-px min-w-4 flex-1 sm:block', state === 'done' ? 'bg-success' : 'bg-border')} />}
    </li>
  );
}

function Checklist({ steps }: { steps: readonly ProgressStep[] }) {
  const { text } = useNumberFormat();
  return (
    <ol className="grid auto-rows-fr gap-2 sm:grid-cols-2 lg:grid-cols-5" data-testid="case-progress" aria-label="Investigation checklist">
      {steps.map((step) => {
        const Icon = step.done ? StatusIcon.success : StatusIcon.pending;
        return (
          <li key={step.key} className="flex h-full flex-col gap-1 rounded-md border p-3 text-sm" data-done={step.done}>
            <span className="flex items-center gap-1.5 font-medium">
              <Icon aria-hidden="true" className={cn('h-4 w-4 shrink-0', step.done ? 'text-success' : 'text-muted-foreground')} />
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

/**
 * F-4: the workflow stages Draft → … → Closed as a horizontal stepper (done ✓ / current / upcoming, the current
 * one `aria-current="step"`), then the content checklist in one aligned grid. The server decides the moves.
 */
export function CaseStepper({ status, steps }: { status: string | null; steps: readonly ProgressStep[] }) {
  const current = stageIndexOf(status);
  return (
    <div className="space-y-4" data-testid="case-stepper">
      <nav aria-label="Investigation stages">
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
          {CASE_STAGES.map((stage, index) => (
            <Stage key={stage} label={statusLabel(stage)} state={stageStateOf(index, current)} index={index} last={index === CASE_STAGES.length - 1} />
          ))}
        </ol>
      </nav>
      <Checklist steps={steps} />
    </div>
  );
}
