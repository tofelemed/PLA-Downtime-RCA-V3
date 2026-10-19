import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { UnitSelect } from '@/features/master-data/components/unit-select';
import { NumberText } from '@/features/ux-kit/number-text';
import { useEquipmentJourney } from './journey-context';
import { canOpenStep, SETUP_PHASES, SETUP_STEPS, setupStep, stepPrerequisite } from './setup-steps';

/** Visible across normal save/detail navigation while the user chooses to follow the setup guide. */
export function SetupJourneyBar() {
  const context = useEquipmentJourney();
  const capabilities = useCapabilities();
  if (!context?.journey) return null;
  const { journey, openStep } = context;
  const step = setupStep(journey.stepId);
  const phase = SETUP_PHASES.find((item) => item.id === step.phase)!;
  const index = SETUP_STEPS.indexOf(step);
  const next = SETUP_STEPS[index + 1];
  const previous = SETUP_STEPS[index - 1];
  const restriction = stepPrerequisite(step, journey);
  const nextRestriction = next ? stepPrerequisite(next, journey) : null;
  return <aside aria-label="Equipment setup navigation" className="mb-5 space-y-3 rounded-lg border border-primary/30 bg-background p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-medium">Equipment setup · {phase.title} · Step <NumberText value={index + 1} /> of <NumberText value={SETUP_STEPS.length} />: {step.title}{step.optional ? ' (optional)' : ''}</p>
      <div className="flex gap-2"><Button asChild size="sm" variant="outline"><Link to="/equipment-setup">All setup steps</Link></Button><Button size="sm" variant="ghost" onClick={context.stop}>Exit guide</Button></div>
    </div>
    <p className="text-sm">{step.action}</p>
    <p className="text-sm text-muted-foreground"><strong>Check before continuing:</strong> {step.verify}</p>
    <div className="max-w-sm"><UnitSelect id="setup-unit" label="Setup production unit" value={journey.unitId} onChange={context.chooseUnit} /></div>
    {restriction && <p className="text-sm text-warning">{restriction}</p>}
    {!canOpenStep(step, capabilities) && <p className="text-sm text-muted-foreground">Your current role cannot open this step. Ask a permitted user to configure it, or use an authorized account.</p>}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={!previous || !canOpenStep(previous, capabilities) || !!stepPrerequisite(previous, journey)} onClick={() => previous && openStep(previous.id)}>Previous setup step</Button>
      <Button size="sm" variant="outline" disabled={!!restriction || !canOpenStep(step, capabilities)} onClick={() => openStep(step.id)}>Open this step</Button>
      {next ? <Button size="sm" disabled={!!nextRestriction || !canOpenStep(next, capabilities)} onClick={() => openStep(next.id)}>Next setup step</Button> : <Button size="sm" onClick={context.stop}>Finish guide</Button>}
      {step.related?.map((link) => <Button asChild key={link.label} size="sm" variant="link"><Link to={link.to(journey)}>{link.label}</Link></Button>)}
    </div>
    {nextRestriction && <p className="text-xs text-muted-foreground">Next step: {nextRestriction}</p>}
    <p className="text-xs text-muted-foreground">Save or approve the page before moving on. Guide navigation does not save changes, approve records or certify readiness. Use the selected setup unit in each form; its own Unit field remains authoritative.</p>
  </aside>;
}
