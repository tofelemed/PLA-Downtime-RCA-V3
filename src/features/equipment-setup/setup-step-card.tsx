import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { NumberText } from '@/features/ux-kit/number-text';
import { UiIcon } from '@/lib/icons';
import { StepReadinessBadge } from './readiness-status';
import { canOpenStep, SETUP_STEPS, type SetupStep } from './setup-steps';

function StepLinks({ step, unitId }: { step: SetupStep; unitId: string }) {
  const allowed = canOpenStep(step, useCapabilities());
  return <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
    {allowed
      ? <Button asChild size="sm"><Link to={step.to({ unitId })}>Go to {step.page}<UiIcon.next aria-hidden className="ml-1 h-4 w-4" /></Link></Button>
      : <Button size="sm" disabled aria-describedby={`setup-step-${step.id}-denied`}>Go to {step.page}</Button>}
    {allowed && step.related?.map((link) => <Button asChild key={link.label} size="sm" variant="link" className="h-auto px-1"><Link to={link.to}>{link.label}</Link></Button>)}
    {!allowed && <p id={`setup-step-${step.id}-denied`} className="w-full text-xs text-muted-foreground">Your role cannot open this page; ask a permitted user to do this step.</p>}
  </div>;
}

/** One step of the guide: what to do, how to check it and a direct link to the page where it is done. */
export function SetupStepCard({ step, unitId }: { step: SetupStep; unitId: string }) {
  return <li aria-labelledby={`setup-step-${step.id}`} className="flex gap-3 p-4 sm:gap-4">
    <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium text-muted-foreground"><NumberText value={SETUP_STEPS.indexOf(step) + 1} /></span>
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`setup-step-${step.id}`} className="font-medium">{step.title}</h3>
        {step.optional && <span className="whitespace-nowrap rounded border px-1.5 py-0.5 text-xs text-muted-foreground">Optional</span>}
        <StepReadinessBadge stepId={step.id} />
      </div>
      <p className="text-sm">{step.action}</p>
      <p className="text-sm text-muted-foreground"><span className="font-medium">Check:</span> {step.verify}</p>
      {step.hint && <p className="text-xs text-muted-foreground">{step.hint}</p>}
      <StepLinks step={step} unitId={unitId} />
    </div>
  </li>;
}
