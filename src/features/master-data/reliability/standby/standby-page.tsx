import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { AddDialog, useAddDialog } from '@/features/ux-kit/add-dialog';
import { RcaCard } from '@/features/rca/components/rca-card';
import { ActionIcon } from '@/lib/icons';
import { MasterDataLayout } from '../../components/master-data-layout';
import { useReliabilityFormat } from '../shared/use-reliability-format';
import { StandbyMetricsSection } from './standby-metrics-section';
import { StandbyRegisterForm } from './standby-register-form';
import { StandbyRegistrationsTable } from './standby-registrations-table';

/** Header actions (SETUP_UX_FIXES Phase 4): Import log CSV opens the import sub-page, Register standby a dialog. */
function HeaderActions({ onAdd }: { onAdd: () => void }) {
  return (
    <>
      <Button asChild variant="outline" data-testid="standby-import-open">
        <Link to="/master-data/standby-equipment/import"><ActionIcon.import aria-hidden="true" />Import log CSV</Link>
      </Button>
      <Button onClick={onAdd} data-testid="standby-register-new"><ActionIcon.add aria-hidden="true" />Register standby</Button>
    </>
  );
}

/**
 * `/master-data/standby-equipment` (SME D9): spare pumps and standby compressors — registrations, their
 * demand / test / running log and the measures the server computes from it.
 */
export function StandbyEquipmentPage() {
  const { canWriteStandby } = useCapabilities();
  const format = useReliabilityFormat();
  const adding = useAddDialog();
  return (
    <MasterDataLayout
      title="Standby equipment"
      alsoAllowed={canWriteStandby}
      actions={canWriteStandby ? <HeaderActions onAdd={adding.open} /> : undefined}
    >
      <RcaCard title="Registrations" info="Equipment that waits on standby is judged on failed starts per demand, not on calendar time." testId="standby-registrations">
        <StandbyRegistrationsTable format={format} canWrite={canWriteStandby} />
      </RcaCard>
      <StandbyMetricsSection format={format} />
      <AddDialog open={adding.isOpen} onOpenChange={adding.setOpen} title="Register standby equipment" testId="standby-register-dialog">
        <StandbyRegisterForm format={format} onSaved={adding.saved} onCancel={adding.close} />
      </AddDialog>
      {adding.resultElement}
    </MasterDataLayout>
  );
}
