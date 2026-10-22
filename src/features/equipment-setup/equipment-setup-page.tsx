import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { pageNameOf } from '@/features/auth/navigation-items';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { PageGate } from '@/features/admin/shared/page-gate';
import { UnitSelect } from '@/features/master-data/components/unit-select';
import { NumberText } from '@/features/ux-kit/number-text';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { EquipmentReadiness } from './equipment-readiness';
import { SetupPhaseSection } from './setup-phase-section';
import { SETUP_PHASES, SETUP_STEPS, type SetupPhaseId } from './setup-steps';
import { useGuideUnit } from './use-guide-unit';

const ALL_PHASES: ReadonlySet<SetupPhaseId> = new Set(SETUP_PHASES.map((phase) => phase.id));

/** Which phases are expanded; all of them at first so the whole guide can be scanned. */
function useOpenPhases() {
  const [open, setOpen] = useState<ReadonlySet<SetupPhaseId>>(ALL_PHASES);
  const toggle = (id: SetupPhaseId, isOpen: boolean) => setOpen((current) => {
    if (current.has(id) === isOpen) return current;
    const next = new Set(current);
    if (isOpen) next.add(id);
    else next.delete(id);
    return next;
  });
  return { open, toggle, expandAll: () => setOpen(ALL_PHASES), collapseAll: () => setOpen(new Set()) };
}

function GuideToolbar({ unitId, onUnitChange, phases }: { unitId: string; onUnitChange: (id: string) => void; phases: ReturnType<typeof useOpenPhases> }) {
  return <section aria-label="Guide options" className="flex flex-wrap items-end justify-between gap-4 rounded-lg border bg-background p-4">
    <div className="w-full max-w-sm space-y-1">
      <UnitSelect id="setup-guide-unit" label="Production unit (optional)" value={unitId} onChange={onUnitChange} allowAll allLabel="No unit selected" />
      <p className="text-xs text-muted-foreground">Choose a unit to open it directly from the links below and to run its readiness checks.</p>
    </div>
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={phases.open.size === ALL_PHASES.size} onClick={phases.expandAll}>Expand all</Button>
      <Button size="sm" variant="outline" disabled={phases.open.size === 0} onClick={phases.collapseAll}>Collapse all</Button>
    </div>
  </section>;
}

/** Reference guide: every phase and step of setting up a production unit, each linking to the page where it is done. */
export function EquipmentSetupPage() {
  const capabilities = useCapabilities();
  const [unitId, setUnitId] = useGuideUnit();
  const phases = useOpenPhases();
  const description = <>Set up a production unit, such as an HDPE extruder, in <NumberText value={SETUP_PHASES.length} /> phases and <NumberText value={SETUP_STEPS.length} /> steps. Each step links to the page where you do it.</>;
  return <PageGate title={pageNameOf('/equipment-setup')} allowed={capabilities.canReachMasterData} deniedText="Your current role cannot access the equipment setup guide.">
    <Page>
      <PageHeader title={pageNameOf('/equipment-setup')} description={description} />
      <GuideToolbar unitId={unitId} onUnitChange={setUnitId} phases={phases} />
      <EquipmentReadiness unitId={unitId}>
        <ol aria-label="Setup phases" className="relative space-y-4 before:absolute before:bottom-6 before:left-4 before:top-6 before:w-px before:bg-border sm:before:left-5">
          {SETUP_PHASES.map((phase, index) => <SetupPhaseSection key={phase.id} phase={phase} number={index + 1} unitId={unitId} open={phases.open.has(phase.id)} onOpenChange={(isOpen) => phases.toggle(phase.id, isOpen)} />)}
        </ol>
      </EquipmentReadiness>
      <p className="text-sm text-muted-foreground">Opening a page from this guide does not save, approve or certify anything. Finish each step on its own page, then review its check.</p>
    </Page>
  </PageGate>;
}
