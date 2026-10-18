import { StatusIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import type { ProgressStep } from '../../model/case-progress';
import { CASE_STAGES, stageIndexOf, stageStateOf, type StageState } from '../../model/case-stages';
import { statusLabel } from '../../model/rca-labels';

const STATE_TEXT: Readonly<Record<StageState, string>> = { done: 'done', current: 'current stage', upcoming: 'to come' };

const STATE_CLASS: Readonly<Record<StageState, string>> = {
  done: 'border-success/40 text-success',
  current: 'border-info bg-info/10 font-semibold text-info',
  upcoming: 'text-muted-foreground',
};

function Stage({ label, state }: { label: string; state: StageState }) {
  const Icon = state === 'done' ? StatusIcon.success : StatusIcon.pending;
  return (
    <li aria-current={state === 'current' ? 'step' : undefined} className={cn('flex items-center gap-1 rounded border px-2 py-1 text-sm', STATE_CLASS[state])} data-state={state}>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {label}
      <span className="sr-only"> ({STATE_TEXT[state]})</span>
    </li>
  );
}

function Checklist({ steps }: { steps: readonly ProgressStep[] }) {
  const { text } = useNumberFormat();
  return (
    <ol className="grid gap-2 sm:grid-cols-5" data-testid="case-progress" aria-label="Investigation checklist">
      {steps.map((step) => {
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

/**
 * F-4: the workflow stages Draft → … → Closed with the current one marked (`aria-current="step"`), and the
 * content checklist as hints for the current stage. The server decides the moves; this only shows them.
 */
export function CaseStepper({ status, steps }: { status: string | null; steps: readonly ProgressStep[] }) {
  const current = stageIndexOf(status);
  return (
    <div className="space-y-3" data-testid="case-stepper">
      <nav aria-label="Investigation stages">
        <ol className="flex flex-wrap items-center gap-2">
          {CASE_STAGES.map((stage, index) => (
            <Stage key={stage} label={statusLabel(stage)} state={stageStateOf(index, current)} />
          ))}
        </ol>
      </nav>
      <div className="space-y-1">
        <p className="text-sm font-medium" data-testid="current-stage">
          Now: {statusLabel(status)}. What the investigation has so far:
        </p>
        <Checklist steps={steps} />
      </div>
    </div>
  );
}
