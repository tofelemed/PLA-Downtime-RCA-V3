import { EquipmentReadiness } from './equipment-readiness';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { PageGate } from '@/features/admin/shared/page-gate';
import { UnitSelect } from '@/features/master-data/components/unit-select';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { useEquipmentJourney } from './journey-context';
import { emptySelection } from './journey-storage';
import { canOpenStep, SETUP_PHASES, setupStep, stepPrerequisite } from './setup-steps';
import { SetupPhaseSection } from './setup-phase-section';

/** Start or resume the real configuration pages; readiness comes from the backend previews/periods. */
export function EquipmentSetupPage() {
  const context = useEquipmentJourney();
  const capabilities = useCapabilities();
  const selection = context?.journey ?? emptySelection;
  const current = setupStep(context?.journey?.stepId ?? 'plant');
  return <PageGate title="Equipment setup guide" allowed={capabilities.canReachMasterData} deniedText="Your current role cannot access the equipment setup guide.">
    <Page>
      <PageHeader title="Equipment setup guide" description="Set up one production unit, such as an HDPE extruder, in six phases. Expand a phase for the exact actions and checks." />
      <section aria-label="Start or resume equipment setup" className="space-y-3 rounded-lg border bg-background p-4">
        <p className="text-sm">Start with the plant selected in the header. Reuse existing plant settings, products, code libraries and published calendars when they apply; create only the records missing for this equipment.</p>
        <p className="text-sm text-muted-foreground">Phases 1–4 configure the equipment. Phases 5–6 prove its first production period and show the results. Your place is remembered in this browser session for this user and plant.</p>
        {!context?.journey && <div className="max-w-sm"><UnitSelect id="setup-existing-unit" label="Existing production unit (optional)" value="" disabled={!context} onChange={(id) => context?.chooseUnit(id)} /></div>}
        <Button disabled={!context || !canOpenStep(current, capabilities) || !!stepPrerequisite(current, selection)} onClick={() => context?.openStep(current.id)}>{context?.journey ? `Continue: ${current.title}` : 'Start equipment setup'}</Button>
        <p className="text-xs text-muted-foreground">Automatic checks show saved evidence for their named requirements. A visited step is not proof of completion: save, publish or approve on its actual page, then review its checks.{capabilities.isSuperAdmin ? ' SuperAdmin can perform every role personally.' : ''}</p>
      </section>
      <EquipmentReadiness>
      <div className="space-y-3" aria-label="Equipment setup phases">
        {SETUP_PHASES.map((phase, index) => <SetupPhaseSection key={`${phase.id}:${current.phase}`} phase={phase} number={index + 1} expanded={phase.id === current.phase} />)}
      </div>
      </EquipmentReadiness>
      <p className="text-sm text-muted-foreground">Exit guide closes navigation only. Saved records remain available on their normal pages.</p>
    </Page>
  </PageGate>;
}
