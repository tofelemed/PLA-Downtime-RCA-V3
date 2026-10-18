import { StepReadinessBadge } from './readiness-status';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useEquipmentJourney } from './journey-context';
import { emptySelection } from './journey-storage';
import { SETUP_STEPS, stepPrerequisite, type SetupPhase, type SetupStep } from './setup-steps';

function SetupStepCard({ step, number }: { step: SetupStep; number: number }) {
  const context = useEquipmentJourney();
  const capabilities = useCapabilities();
  const restriction = stepPrerequisite(step, context?.journey ?? emptySelection);
  const allowed = capabilities[step.capability];
  const current = context?.journey?.stepId === step.id;
  return <li className="rounded-lg border bg-background p-4" aria-current={current ? 'step' : undefined}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-medium">{number}. {step.title}{step.optional ? ' (optional)' : ''}</h3>
      <StepReadinessBadge stepId={step.id} />
      <Button size="sm" variant="outline" disabled={!context || !allowed || !!restriction} onClick={() => context?.openStep(step.id)}>{current ? 'Resume step' : 'Open step'}</Button>
    </div>
    <p className="mt-2 text-sm">{step.action}</p>
    <p className="mt-1 text-sm text-muted-foreground">Check: {step.verify}</p>
    {restriction && <p className="mt-1 text-xs text-muted-foreground">{restriction}</p>}
    {!allowed && <p className="mt-1 text-xs text-muted-foreground">Your current role cannot open this step; a permitted user must handle it.</p>}
  </li>;
}

export function SetupPhaseSection({ phase, number, expanded }: { phase: SetupPhase; number: number; expanded: boolean }) {
  const steps = SETUP_STEPS.filter((step) => step.phase === phase.id);
  return <details open={expanded} className="rounded-lg border bg-background p-4">
    <summary aria-label={`Phase ${number}: ${phase.title}`} className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <h2 className="inline font-medium">Phase {number}: {phase.title}
        <span className="ml-2 text-sm font-normal text-muted-foreground">{steps.length} {steps.length === 1 ? 'step' : 'steps'}</span>
      </h2>
    </summary>
    <p className="my-3 text-sm text-muted-foreground">{phase.description}</p>
    <ol aria-label={`${phase.title} steps`} className="space-y-3" start={SETUP_STEPS.indexOf(steps[0]) + 1}>
      {steps.map((step) => <SetupStepCard key={step.id} step={step} number={SETUP_STEPS.indexOf(step) + 1} />)}
    </ol>
  </details>;
}
