import { UiIcon } from '@/lib/icons';
import { NumberText } from '@/features/ux-kit/number-text';
import { SetupStepCard } from './setup-step-card';
import { stepsOfPhase, type SetupPhase } from './setup-steps';

export interface SetupPhaseSectionProps {
  phase: SetupPhase;
  number: number;
  unitId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** One phase on the guide's vertical timeline: number badge, collapsible list of its steps. */
export function SetupPhaseSection({ phase, number, unitId, open, onOpenChange }: SetupPhaseSectionProps) {
  const steps = stepsOfPhase(phase.id);
  const headingId = `setup-phase-${phase.id}`;
  return <li aria-labelledby={headingId} className="relative pl-11 sm:pl-14">
    <span aria-hidden className="absolute left-0 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground sm:left-1"><NumberText value={number} /></span>
    <details open={open} onToggle={(event) => onOpenChange(event.currentTarget.open)} className="group rounded-lg border bg-background">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-lg p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 space-y-1">
          <h2 id={headingId} className="font-semibold">Phase <NumberText value={number} />: {phase.title}</h2>
          <p className="text-sm text-muted-foreground">{phase.description}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
          <NumberText value={steps.length} /> {steps.length === 1 ? 'step' : 'steps'}
          <UiIcon.expand aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <ol aria-label={`${phase.title} steps`} className="divide-y border-t">
        {steps.map((step) => <SetupStepCard key={step.id} step={step} unitId={unitId} />)}
      </ol>
    </details>
  </li>;
}
